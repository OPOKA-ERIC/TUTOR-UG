import { ApiError, corsHeaders, handlePreflight, json, isEmail, checkRateLimit } from "../_shared/security.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const dbHeaders = {
  "apikey": supabaseKey,
  "Authorization": `Bearer ${supabaseKey}`,
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const CORS = corsHeaders(req);

  try {
    const body = await req.json();
    const { email: emailInput, otp_code } = body;

    if (!isEmail(emailInput)) throw new ApiError(400, "A valid email address is required.");
    if (typeof otp_code !== "string" || !/^\d{6}$/.test(otp_code.trim())) {
      throw new ApiError(400, "A valid 6-digit code is required.");
    }

    const email = (emailInput as string).trim().toLowerCase();

    await checkRateLimit(`verify-otp:${email}`, 10, 900);

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/password_reset_otps?email=eq.${encodeURIComponent(email)}&used=eq.false&order=created_at.desc&limit=1`,
      { headers: dbHeaders }
    );
    const rows = await resp.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new ApiError(400, "No active OTP found. Please request a new one.");
    }

    const record = rows[0];

    if (new Date() > new Date(record.expires_at)) {
      throw new ApiError(400, "OTP has expired. Please request a new one.");
    }

    if (record.otp_code !== otp_code.trim()) {
      throw new ApiError(400, "Incorrect OTP. Please try again.");
    }

    await fetch(
      `${supabaseUrl}/rest/v1/password_reset_otps?id=eq.${record.id}`,
      {
        method: "PATCH",
        headers: { ...dbHeaders, "Prefer": "return=minimal" },
        body: JSON.stringify({ used: true }),
      }
    );

    return json({ success: true }, 200, CORS);
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    return json({ error: error.message }, status, CORS);
  }
});