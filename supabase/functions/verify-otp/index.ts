const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const dbHeaders = {
  "apikey": supabaseKey,
  "Authorization": `Bearer ${supabaseKey}`,
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  try {
    const { email: rawEmail, otp_code } = await req.json();
    if (!rawEmail || !otp_code) return json({ error: "Email and OTP are required" }, 400);
    const email = rawEmail.trim().toLowerCase();

    // Fetch the latest unused OTP for this email
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/password_reset_otps?email=eq.${encodeURIComponent(email)}&used=eq.false&order=created_at.desc&limit=1`,
      { headers: dbHeaders }
    );
    const rows = await resp.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ error: "No active OTP found. Please request a new one." }, 400);
    }

    const record = rows[0];

    // Check expiry
    if (new Date() > new Date(record.expires_at)) {
      return json({ error: "OTP has expired. Please request a new one." }, 400);
    }

    // Check code match
    if (record.otp_code !== otp_code.trim()) {
      return json({ error: "Incorrect OTP. Please try again." }, 400);
    }

    // Mark OTP as used
    await fetch(
      `${supabaseUrl}/rest/v1/password_reset_otps?id=eq.${record.id}`,
      {
        method: "PATCH",
        headers: { ...dbHeaders, "Prefer": "return=minimal" },
        body: JSON.stringify({ used: true }),
      }
    );

    return json({ success: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
