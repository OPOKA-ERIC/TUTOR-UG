import { getDbHeaders, getSupabaseUrl } from '../utils/supabase-admin.js'
import { buildSuccessEmail } from '../utils/email.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const { email: rawEmail, new_password } = req.body
    if (!rawEmail || !new_password) return res.status(400).json({ error: 'Email and new password are required' })
    if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const email = rawEmail.trim().toLowerCase()
    const supabaseUrl = getSupabaseUrl()
    const dbHeaders = getDbHeaders()
    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'

    const listResp = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { headers: dbHeaders }
    )
    const listData = await listResp.json()
    const authUser = listData?.users?.[0]
    if (!authUser) return res.status(404).json({ error: 'User not found.' })

    const updateResp = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${authUser.id}`,
      {
        method: 'PUT',
        headers: dbHeaders,
        body: JSON.stringify({ password: new_password }),
      }
    )
    if (!updateResp.ok) {
      const err = await updateResp.text()
      throw new Error(`Failed to update password: ${err}`)
    }

    const userResp = await fetch(
      `${supabaseUrl}/rest/v1/users?user_id=eq.${authUser.id}&select=name&limit=1`,
      { headers: dbHeaders }
    )
    const users = await userResp.json()
    const userName = users?.[0]?.name || 'Student'

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `TutorUG <${fromEmail}>`,
        to: [email],
        subject: 'Your TutorUG Password Has Been Reset',
        html: buildSuccessEmail(userName),
      }),
    })

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
