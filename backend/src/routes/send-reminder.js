import { buildReminderEmail } from '../utils/email.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const { email, name, subject, start_time } = req.body
    if (!email || !subject) return res.status(400).json({ error: 'Missing fields' })

    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `TutorUG <${fromEmail}>`,
        to: [email],
        subject: `⏰ Study Reminder: ${subject} starts in 15 minutes!`,
        html: buildReminderEmail(name ?? 'Student', subject, start_time ?? ''),
      }),
    })

    if (!resp.ok) throw new Error(await resp.text())
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
