const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendKey   = Deno.env.get("RESEND_API_KEY")!;
const fromEmail   = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

const dbHeaders = {
  "apikey": supabaseKey,
  "Authorization": `Bearer ${supabaseKey}`,
  "Content-Type": "application/json",
};

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  try {
    const { email: rawEmail } = await req.json();
    if (!rawEmail) return json({ error: "Email is required" }, 400);
    const email = rawEmail.trim().toLowerCase();

    // 1. Check if email belongs to a user via Auth Admin API (source of truth)
    const normalizedEmail = email.trim().toLowerCase();
    const authResp = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(normalizedEmail)}`,
      { headers: dbHeaders }
    );
    const authData = await authResp.json();
    const authUser = authData?.users?.[0];
    if (!authUser) {
      return json({ error: "No account found with this email address." }, 404);
    }

    // 2. Try to get name from profile table, fall back gracefully
    const profileResp = await fetch(
      `${supabaseUrl}/rest/v1/users?user_id=eq.${authUser.id}&select=name&limit=1`,
      { headers: dbHeaders }
    );
    const profiles = await profileResp.json();
    const userName = profiles?.[0]?.name || "Student";

    // 2. Invalidate any existing unused OTPs for this email
    await fetch(
      `${supabaseUrl}/rest/v1/password_reset_otps?email=eq.${encodeURIComponent(email)}&used=eq.false`,
      {
        method: "PATCH",
        headers: { ...dbHeaders, "Prefer": "return=minimal" },
        body: JSON.stringify({ used: true }),
      }
    );

    // 3. Generate OTP and store with 15-minute expiry
    const otpCode   = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const insertResp = await fetch(`${supabaseUrl}/rest/v1/password_reset_otps`, {
      method: "POST",
      headers: { ...dbHeaders, "Prefer": "return=minimal" },
      body: JSON.stringify({ email, otp_code: otpCode, expires_at: expiresAt, used: false }),
    });
    if (!insertResp.ok) throw new Error("Failed to store OTP");

    // 4. Send OTP email via Resend
    const emailResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `TutorUG <${fromEmail}>`,
        to: [email],
        subject: "Your TutorUG Password Reset Code",
        html: buildOtpEmail(userName, otpCode),
      }),
    });
    if (!emailResp.ok) {
      const err = await emailResp.text();
      throw new Error(`Failed to send email: ${err}`);
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});

function buildOtpEmail(name: string, otp: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#0f0f1a;margin:0;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#1a1a2e;border-radius:16px;padding:32px;border:1px solid #2a2a3e;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#FFB800;margin:0;font-size:24px;">&#127482;&#127468; TutorUG</h1>
      <p style="color:#888;margin:4px 0 0;">Uganda's Smart Learning Companion</p>
    </div>
    <h2 style="color:#fff;font-size:20px;margin-bottom:8px;">Password Reset Request</h2>
    <p style="color:#ccc;font-size:15px;">Hi ${name},</p>
    <p style="color:#ccc;font-size:15px;">Use the code below to reset your password. It expires in <strong style="color:#FFB800;">15 minutes</strong>.</p>
    <div style="background:#0f0f1a;border:2px solid #FFB800;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
      <span style="font-size:40px;font-weight:bold;color:#FFB800;letter-spacing:10px;">${otp}</span>
    </div>
    <p style="color:#888;font-size:13px;">If you did not request this, please ignore this email. Your account is safe.</p>
    <hr style="border:none;border-top:1px solid #2a2a3e;margin:24px 0;">
    <p style="color:#555;font-size:12px;text-align:center;">© 2025 TutorUG | info@tutorug.com</p>
  </div>
</body>
</html>`;
}

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
