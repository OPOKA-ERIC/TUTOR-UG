import { getDbHeaders, getSupabaseUrl } from '../utils/supabase-admin.js'

// Collects every piece of data we hold for the given user into a
// single JSON document (data subject access request / export).
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const userId = req.user.id
    const supabaseUrl = getSupabaseUrl()
    const dbHeaders = getDbHeaders()

    async function selectTable(table, filterKey) {
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/${table}?${encodeURIComponent(filterKey)}=eq.${encodeURIComponent(userId)}&order=created_at.asc`,
        { headers: dbHeaders }
      )
      if (!resp.ok) return []
      return resp.json()
    }

    const [profile, chatSessions, chatMessages, documents, documentSections, quizResults, settings, podcasts, studyLogs, timetable, reviews, meetings, participants] = await Promise.all([
      (async () => {
        const r = await fetch(`${supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(userId)}&limit=1`, { headers: dbHeaders })
        return (await r.json())[0] || null
      })(),
      selectTable('chat_sessions', 'user_id'),
      selectTable('chat_messages', 'user_id'),
      selectTable('documents', 'user_id'),
      selectTable('document_sections', 'user_id'),
      selectTable('quiz_results', 'user_id'),
      selectTable('user_settings', 'user_id'),
      selectTable('podcast_sessions', 'user_id'),
      selectTable('study_session_logs', 'user_id'),
      selectTable('timetable_entries', 'user_id'),
      (async () => {
        const r = await fetch(`${supabaseUrl}/rest/v1/reviews?user_id=eq.${encodeURIComponent(userId)}`, { headers: dbHeaders })
        return r.ok ? r.json() : []
      })(),
      (async () => {
        const r = await fetch(`${supabaseUrl}/rest/v1/meetings?host_id=eq.${encodeURIComponent(userId)}`, { headers: dbHeaders })
        return r.ok ? r.json() : []
      })(),
      selectTable('meeting_participants', 'user_id'),
    ])

    const exportData = {
      exported_at: new Date().toISOString(),
      profile,
      chat_sessions: chatSessions,
      chat_messages: chatMessages,
      documents: documents,
      document_sections: documentSections,
      quiz_results: quizResults,
      user_settings: settings,
      podcast_sessions: podcasts,
      study_session_logs: studyLogs,
      timetable_entries: timetable,
      reviews: reviews,
      meetings: meetings,
      meeting_participants: participants,
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="tutorug-data-${userId.slice(0, 8)}.json"`)
    res.json(exportData)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}