import { getDbHeaders, getSupabaseUrl } from '../utils/supabase-admin.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { inviteId, response } = req.body
    if (!inviteId || !['accepted', 'refused'].includes(response)) {
      return res.status(400).json({ error: 'inviteId and valid response (accepted/refused) required' })
    }

    const supabaseUrl = getSupabaseUrl()
    const dbHeaders = getDbHeaders()

    // Update invite status
    const updateResp = await fetch(
      `${supabaseUrl}/rest/v1/meeting_invites?id=eq.${inviteId}`,
      {
        method: 'PATCH',
        headers: { ...dbHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({ status: response === 'accepted' ? 'accepted' : 'refused' }),
      }
    )
    const updated = await updateResp.json()
    if (!updated?.length) return res.status(404).json({ error: 'Invite not found' })

    res.json({ success: true, invite: updated[0] })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
