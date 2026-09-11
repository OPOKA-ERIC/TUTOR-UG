import { ApiError, corsHeaders, handlePreflight, json, isEmail, checkRateLimit } from "../_shared/security.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendKey   = Deno.env.get("RESEND_API_KEY")!;
const fromEmail   = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

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
    const { email: emailInput, new_password } = body;

    if (!isEmail(emailInput)) throw new ApiError(400, "A valid email address is required.");
    if (typeof new_password !== "string" || new_password.length < 8 || new_password.length > 128) {
      throw new ApiError(400, "Password must be between 8 and 128 characters.");
    }

    const email = (emailInput as string).trim().toLowerCase();

    await checkRateLimit(`reset-password:${email}`, 5, 900);

    // 1. Look up the user's auth ID via Supabase Admin API.
    const listResp = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { headers: dbHeaders }
    );
    const listData = await listResp.json();
    const authUser = listData?.users?.[0];
    if (!authUser) throw new ApiError(404, "User not found.");

    // 2. Update the password via Supabase Admin API (handles hashing internally).
    const updateResp = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${authUser.id}`,
      {
        method: "PUT",
        headers: dbHeaders,
        body: JSON.stringify({ password: new_password }),
      }
    );
    if (!updateResp.ok) {
      const err = await updateResp.text();
      throw new Error(`Failed to update password: ${err}`);
    }

    // 3. Get the user's name from the users table.
    const userResp = await fetch(
      `${supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(authUser.id)}&select=name&limit=1`,
      { headers: dbHeaders }
    );
    const users = await userResp.json();
    const userName = users?.[0]?.name || "Student";

    // 4. Send a success email via Resend.
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `TutorUG <${fromEmail}>`,
        to: [email],
        subject: "Your TutorUG Password Has Been Reset",
        html: buildSuccessEmail(userName),
      }),
    });

    return json({ success: true }, 200, CORS);
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    return json({ error: error.message }, status, CORS);
  }
});

function buildSuccessEmail(name: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#0f0f1a;margin:0;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#1a1a2e;border-radius:16px;padding:32px;border:1px solid #2a2a3e;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#FFB800;margin:0;font-size:24px;">&#127482;&#127468; TutorUG</h1>
      <p style="color:#888;margin:4px 0 0;">Uganda's Smart Learning Companion</p>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      <div style="width:64px;height:64px;background:#1a3a1a;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:32px;">&#10003;</div>
    </div>
    <h2 style="color:#4CAF50;font-size:20px;text-align:center;margin-bottom:8px;">Password Reset Successful</h2>
    <p style="color:#ccc;font-size:15px;">Hi ${name},</p>
    <p style="color:#ccc;font-size:15px;">Your TutorUG password has been successfully reset. You can now log in with your new password.</p>
    <p style="color:#888;font-size:13px;margin-top:24px;">If you did not make this change, please contact us immediately at <a href="mailto:info@tutorug.com" style="color:#FFB800;">info@tutorug.com</a>.</p>
    <hr style="border:none;border-top:1px solid #2a2a3e;margin:24px 0;">
    <p style="color:#555;font-size:12px;text-align:center;">© 2025 TutorUG | info@tutorug.com</p>
  </div>
</body>
</html>`;
}