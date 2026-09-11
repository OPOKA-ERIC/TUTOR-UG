// Shared security helpers for TutorUG Edge Functions.
//
// NOTE: functions must be deployed WITHOUT --no-verify-jwt so the Supabase
// platform validates the JWT signature at the gateway. These helpers then
// check the caller is actually a signed-in user (not the public anon key).

export type AuthContext = { userId: string; token: string }

function decodeBase64Url(s: string): string {
  const clean = s.replace(/-/g, "+").replace(/_/g, "/")
  const pad = clean.length % 4 === 0 ? "" : "=".repeat(4 - (clean.length % 4))
  return atob(clean + pad)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  })
}

// Restricted CORS. Native mobile apps send no Origin header, so they always pass.
export function corsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ||
    "https://tutorug.com,https://www.tutorug.com,https://tutorug.vercel.app,http://localhost:5173,http://localhost:3000")
    .split(",").map((s) => s.trim()).filter(Boolean)
  const origin = req.headers.get("Origin")
  if (origin && allowed.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    }
  }
  return {}
}

export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) })
  }
  return null
}

// Extracts + decodes the caller JWT. The platform gateway has already verified
// the signature; this checks the token belongs to a signed-in user and returns
// their Supabase user id.
export function requireUser(req: Request): AuthContext {
  const authHeader = req.headers.get("Authorization") || ""
  if (!authHeader.startsWith("Bearer ")) throw new ApiError(401, "Authentication required. Please sign in and try again.")
  const token = authHeader.slice(7).trim()

  let payload: Record<string, unknown>
  try {
    const parts = token.split(".")
    if (parts.length !== 3) throw new Error("bad jwt shape")
    payload = JSON.parse(decodeBase64Url(parts[1]))
  } catch {
    throw new ApiError(401, "Invalid or expired session. Please sign in again.")
  }

  const role = payload.role
  const sub = payload.sub
  if (!sub || (role !== "authenticated" && role !== "service_role")) {
    throw new ApiError(401, "Authentication required. Please sign in and try again.")
  }
  return { userId: sub as string, token }
}

// ── input validators ─────────────────────────────────────────────────────
export function isEmail(v: unknown): boolean {
  return typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export function isNonEmptyString(v: unknown, maxLen = 100000): boolean {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen
}

export function isOptionalString(v: unknown, maxLen = 100000): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.length <= maxLen)
}

export function isPlainObject(v: unknown): boolean {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

export function isArrayOrEmpty(v: unknown, maxItems = 1000): boolean {
  return Array.isArray(v) && v.length <= maxItems
}

// ── optional DB-backed rate limiting (uses the service-role key) ─────────
export async function checkRateLimit(key: string, limit = 10, windowSeconds = 900): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  // Fail-open when secret not provisioned so deployments don't break.
  if (!url || !serviceKey) return

  const resp = await fetch(`${url}/rest/v1/rpc/consume_rate_limit`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ rk: key.slice(0, 200), lim: limit, win_seconds: windowSeconds }),
  })
  if (!resp.ok) return
  const allowed = await resp.json()
  if (allowed === false) throw new ApiError(429, "Too many attempts. Please wait a moment and try again.")
}