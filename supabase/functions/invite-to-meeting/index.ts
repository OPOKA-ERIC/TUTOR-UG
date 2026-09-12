import {
  ApiError, corsHeaders, handlePreflight, requireUser, json,
  isNonEmptyString, isEmail,
} from "../_shared/security.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const CORS = corsHeaders(req);

  try {
    const auth = requireUser(req);

    const body = await req.json();
    const { meetingId, emails, hostName } = body;

    if (!isNonEmptyString(meetingId, 128)) throw new ApiError(400, "Meeting ID is required.");
    if (!Array.isArray(emails) || emails.length === 0 || emails.length > 50) {
      throw new ApiError(400, "At least one email is required (max 50).");
    }
    for (const e of emails) if (!isEmail(e)) throw new ApiError(400, "One or more emails are invalid.");

    const sbUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!sbUrl || !serviceKey) {
      throw new ApiError(500, "Invite service is not configured. Set SUPABASE_SERVICE_ROLE_KEY.");
    }

    const adminHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // Load the meeting and verify the caller is its host.
    const meetingResp = await fetch(
      `${sbUrl}/rest/v1/meetings?meeting_id=eq.${meetingId}&select=title,subject,scheduled_at,duration_mins,host_id`,
      { headers: adminHeaders },
    );
    const meetings = await meetingResp.json();
    if (!meetings?.length) throw new ApiError(404, "Meeting not found.");
    const meeting = meetings[0];
    if (meeting.host_id !== auth.userId) {
      throw new ApiError(403, "Only the meeting host can invite people.");
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";
    const results = [];

    for (const raw of emails) {
      const email = String(raw).trim().toLowerCase();
      if (!email) continue;

      // Resolve the invited user's id from their email (null if not registered yet).
      let userId: string | null = null;
      try {
        const authResp = await fetch(
          `${sbUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
          { headers: adminHeaders },
        );
        const authData = await authResp.json();
        userId = authData?.users?.[0]?.id || null;
      } catch {
        // Non-registered addresses keep user_id null.
      }

      // Upsert the invite. Unique constraint is (meeting_id, email).
      await fetch(`${sbUrl}/rest/v1/meeting_invites`, {
        method: "POST",
        headers: { ...adminHeaders, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ meeting_id: meetingId, email, user_id: userId, status: "pending" }),
      });

      // Send an email notification (non-fatal on failure).
      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `TutorUG <${fromEmail}>`,
              to: [email],
              subject: `You're invited to: ${meeting.title}`,
              html: buildInviteEmail(hostName || "A TutorUG user", meeting),
            }),
          });
        } catch {
          // Email failure is non-fatal.
        }
      }

      results.push({ email, userId, status: "invited" });
    }

    return json({ success: true, invited: results }, 200, CORS);
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    return json({ error: error.message }, status, CORS);
  }
});

function buildInviteEmail(inviterName: string, meeting: any): string {
  let dateStr = "";
  try {
    dateStr = new Date(meeting.scheduled_at).toLocaleString("en-UG", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    dateStr = meeting.scheduled_at || "";
  }
  const subject = meeting.subject ? `<p style="color:#aaa;font-size:14px;margin:0 0 4px;">Subject: ${meeting.subject}</p>` : "";
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#0f0f1a;margin:0;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#1a1a2e;border-radius:16px;padding:32px;border:1px solid #2a2a3e;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#FFB800;margin:0;font-size:24px;">&#127482;&#127468; TutorUG</h1>
      <p style="color:#888;margin:4px 0 0;">Uganda's Smart Learning Companion</p>
    </div>
    <h2 style="color:#fff;font-size:20px;margin-bottom:8px;">&#128197; Meeting Invitation</h2>
    <p style="color:#ccc;font-size:15px;">You've been invited to a meeting by <strong style="color:#FFB800;">${inviterName}</strong>.</p>
    <div style="background:#0f0f1a;border:2px solid #FFB800;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="color:#FFB800;font-size:20px;font-weight:bold;margin:0 0 8px;">${meeting.title}</p>
      ${subject}
      <p style="color:#aaa;font-size:14px;margin:0 0 4px;">&#128197; ${dateStr}</p>
      <p style="color:#aaa;font-size:14px;margin:0;">&#9200; ${meeting.duration_mins} minutes</p>
    </div>
    <p style="color:#ccc;font-size:14px;">Open TutorUG to view and join this meeting.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://tutorug.com/meetings" style="background:#FFB800;color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
        View Meeting
      </a>
    </div>
    <hr style="border:none;border-top:1px solid #2a2a3e;margin:24px 0;">
    <p style="color:#555;font-size:12px;text-align:center;">&copy; 2025 TutorUG | info@tutorug.com</p>
  </div>
</body>
</html>`;
}