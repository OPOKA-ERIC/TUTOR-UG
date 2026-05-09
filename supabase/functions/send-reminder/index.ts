const resendKey = Deno.env.get("RESEND_API_KEY")!;
const fromEmail = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

Deno.serve(async (req) => {
  try {
    const { email, name, subject, start_time } = await req.json();
    if (!email || !subject) return json({ error: "Missing fields" }, 400);

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `TutorUG <${fromEmail}>`,
        to: [email],
        subject: `⏰ Study Reminder: ${subject} starts in 15 minutes!`,
        html: buildReminderEmail(name ?? "Student", subject, start_time ?? ""),
      }),
    });

    if (!resp.ok) throw new Error(await resp.text());
    return json({ success: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});

function buildReminderEmail(name: string, subject: string, startTime: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#0f0f1a;margin:0;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#1a1a2e;border-radius:16px;padding:32px;border:1px solid #2a2a3e;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#FFB800;margin:0;font-size:24px;">&#127482;&#127468; TutorUG</h1>
      <p style="color:#888;margin:4px 0 0;">Uganda's Smart Learning Companion</p>
    </div>
    <h2 style="color:#fff;font-size:20px;margin-bottom:8px;">⏰ Study Session Starting Soon!</h2>
    <p style="color:#ccc;font-size:15px;">Hi ${name},</p>
    <p style="color:#ccc;font-size:15px;">
      Your <strong style="color:#FFB800;">${subject}</strong> study session starts in
      <strong style="color:#FFB800;">15 minutes</strong> at <strong style="color:#FFB800;">${startTime}</strong>.
    </p>
    <div style="background:#0f0f1a;border:2px solid #FFB800;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
      <p style="color:#FFB800;font-size:22px;font-weight:bold;margin:0;">📚 ${subject}</p>
      <p style="color:#aaa;font-size:16px;margin:8px 0 0;">Starts at ${startTime}</p>
    </div>
    <p style="color:#ccc;font-size:14px;">
      Get your notes ready, find a quiet spot, and open TutorUG to start your AI-powered learning session!
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://tutorug.com" style="background:#FFB800;color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
        Open TutorUG
      </a>
    </div>
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
