export function buildOtpEmail(name, otp) {
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
    <p style="color:#555;font-size:12px;text-align:center;">&copy; 2025 TutorUG | info@tutorug.com</p>
  </div>
</body>
</html>`
}

export function buildSuccessEmail(name) {
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
    <p style="color:#555;font-size:12px;text-align:center;">&copy; 2025 TutorUG | info@tutorug.com</p>
  </div>
</body>
</html>`
}

export function buildReminderEmail(name, subject, startTime) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#0f0f1a;margin:0;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#1a1a2e;border-radius:16px;padding:32px;border:1px solid #2a2a3e;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#FFB800;margin:0;font-size:24px;">&#127482;&#127468; TutorUG</h1>
      <p style="color:#888;margin:4px 0 0;">Uganda's Smart Learning Companion</p>
    </div>
    <h2 style="color:#fff;font-size:20px;margin-bottom:8px;">&#9200; Study Session Starting Soon!</h2>
    <p style="color:#ccc;font-size:15px;">Hi ${name},</p>
    <p style="color:#ccc;font-size:15px;">
      Your <strong style="color:#FFB800;">${subject}</strong> study session starts in
      <strong style="color:#FFB800;">15 minutes</strong> at <strong style="color:#FFB800;">${startTime}</strong>.
    </p>
    <div style="background:#0f0f1a;border:2px solid #FFB800;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
      <p style="color:#FFB800;font-size:22px;font-weight:bold;margin:0;">&#128218; ${subject}</p>
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
    <p style="color:#555;font-size:12px;text-align:center;">&copy; 2025 TutorUG | info@tutorug.com</p>
  </div>
</body>
</html>`
}
