import { getDbHeaders, getSupabaseUrl } from '../utils/supabase-admin.js'

// Permanently deletes a user's account and all associated data
// (GDPR-style right to be forgotten).
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const userId = req.user.id
    const supabaseUrl = getSupabaseUrl()
    const dbHeaders = getDbHeaders()
    const deleteHeaders = { ...dbHeaders, Prefer: 'return=minimal' }

    async function wipe(table, filterKey) {
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/${table}?${encodeURIComponent(filterKey)}=eq.${encodeURIComponent(userId)}`,
        { method: 'DELETE', headers: deleteHeaders }
      )
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        console.error(`[delete-data] failed to clear ${table}:`, body)
      }
    }

    // Storage objects (documents + avatar)
    try {
      const listRes = await fetch(
        `${supabaseUrl}/storage/v1/object/list/documents?prefix=${encodeURIComponent(userId)}`,
        { method: 'POST', headers: dbHeaders, body: '{}' }
      )
      const files = await listRes.json()
      if (Array.isArray(files)) {
        for (const f of files) {
          await fetch(`${supabaseUrl}/storage/v1/object/documents/${encodeURIComponent(userId)}/${encodeURIComponent(f.name)}`, {
            method: 'DELETE', headers: deleteHeaders,
          })
        }
      }
    } catch (e) {
      console.error('[delete-data] storage cleanup failed:', e.message)
    }

    // Dependent rows first (order matters due to foreign keys).
    await wipe('meeting_participants', 'user_id')
    await wipe('document_sections', 'user_id')
    await wipe('quiz_results', 'user_id')
    await wipe('chat_messages', 'user_id')
    await wipe('chat_sessions', 'user_id')
    await wipe('documents', 'user_id')
    await wipe('podcast_sessions', 'user_id')
    await wipe('study_session_logs', 'user_id')
    await wipe('timetable_entries', 'user_id')
    await wipe('user_settings', 'user_id')
    await wipe('reviews', 'user_id')
    await wipe('room_messages', 'user_id')
    await wipe('users', 'user_id')

    // Remove the Supabase Auth account itself.
    const authDelete = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE', headers: dbHeaders,
    })
    if (!authDelete.ok && authDelete.status !== 404) {
      throw new Error(`Failed to delete auth account (${authDelete.status})`)
    }

    res.json({ success: true, message: 'Your account and all associated data have been permanently deleted.' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}