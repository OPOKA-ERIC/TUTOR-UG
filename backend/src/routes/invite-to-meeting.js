import { getDbHeaders, getSupabaseUrl } from '../utils/supabase-admin.js'
import { buildMeetingInviteEmail } from '../utils/email.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { meetingId, emails, hostName } = req.body
    if (!meetingId || !emails?.length) {
      return res.status(400).json({ error: 'meetingId and emails are required' })
    }

    const supabaseUrl = getSupabaseUrl()
    const dbHeaders = getDbHeaders()
    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'

    // Fetch meeting details
    const meetingResp = await fetch(
      `${supabaseUrl}/rest/v1/meetings?meeting_id=eq.${meetingId}&select=title,subject,scheduled_at,duration_mins`,
      { headers: dbHeaders }
    )
    const meetings = await meetingResp.json()
    if (!meetings?.length) return res.status(404).json({ error: 'Meeting not found' })
    const meeting = meetings[0]

    const results = []

    for (const email of emails) {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) continue

      // Look up user_id from auth
      const authResp = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(normalizedEmail)}`,
        { headers: dbHeaders }
      )
      const authData = await authResp.json()
      const authUser = authData?.users?.[0]
      const userId = authUser?.id || null

      // Upsert invite
      const invite = {
        meeting_id: meetingId,
        email: normalizedEmail,
        user_id: userId,
        status: 'pending',
      }
      await fetch(`${supabaseUrl}/rest/v1/meeting_invites`, {
        method: 'POST',
        headers: { ...dbHeaders, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(invite),
      })

      // Send email notification if Resend is configured
      if (resendKey && normalizedEmail) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: `TutorUG <${fromEmail}>`,
              to: [normalizedEmail],
              subject: `You're invited to: ${meeting.title}`,
              html: buildMeetingInviteEmail(
                hostName || 'A TutorUG user',
                meeting.title,
                meeting.subject,
                meeting.scheduled_at,
                meeting.duration_mins
              ),
            }),
          })
        } catch (e) {
          // Email failure is non-fatal
          console.error('Failed to send invite email:', e.message)
        }
      }

      results.push({ email: normalizedEmail, userId, status: 'invited' })
    }

    res.json({ success: true, invited: results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
