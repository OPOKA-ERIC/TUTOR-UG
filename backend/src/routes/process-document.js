import Anthropic from '@anthropic-ai/sdk'
import { isNonEmptyString, isOptionalString, fail } from '../utils/validate.js'

async function updateDocumentStatus(documentId, status, extra = {}) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  await fetch(`${supabaseUrl}/rest/v1/documents?document_id=eq.${encodeURIComponent(documentId)}`, {
    method: 'PATCH',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, ...extra }),
  })
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const apiKey = process.env.ANTHROPIC_KEY
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_KEY not set' })

    const { documentId, fileName, userId, subject, extractedText } = req.body

    if (!isNonEmptyString(documentId, 128)) return fail(res, 'Document ID is required.')
    if (!isNonEmptyString(userId, 128)) return fail(res, 'User ID is required.')
    if (!isOptionalString(fileName, 255) || !isOptionalString(subject, 120)) {
      return fail(res, 'Invalid document fields.')
    }
    // A user can only process their own documents.
    if (req.user?.id && req.user.id !== userId) {
      return fail(res, 'You can only process your own documents.', 403)
    }

    const anthropic = new Anthropic({ apiKey })
    const textContent = (extractedText && extractedText.trim().length > 50)
      ? extractedText.trim().slice(0, 12000)
      : `Document: ${fileName}\nSubject: ${subject}\nNote: Could not extract text. Please create educational content based on the subject "${subject}".`

    const hasRealContent = extractedText && extractedText.trim().length > 50

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 3000,
      system: `You are an expert educational content analyzer for Ugandan students.
${hasRealContent
  ? 'Break the provided document content into 3-5 logical learning sections based on what is actually written in the document.'
  : 'Create 3-5 educational learning sections for the given subject.'}
Return ONLY a valid JSON array. No extra text before or after.
Each item must have exactly these fields:
- title: string (section heading, plain text no markdown)
- content: string (detailed educational explanation, at least 3 paragraphs)

FORMATTING RULES for the content field:
- Use ## for main topic headings
- Use ### for subtopic headings
- Use **bold** for key terms, definitions, and critical points
- Use *italic* for subtopic names mentioned inline within paragraphs
- Use numbered lists (1. 2. 3.) for steps or sequences
- Use bullet dashes (- ) for non-sequential lists
- Separate paragraphs with a blank line`,
      messages: [{
        role: 'user',
        content: hasRealContent
          ? `Analyze this document content and create learning sections for a student studying ${subject}:\n\n${textContent}`
          : `Create learning sections for a student studying ${subject}. Document name: ${fileName}`,
      }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    let sections = []
    try {
      const match = raw.match(/\[[\s\S]*\]/)
      sections = match ? JSON.parse(match[0]) : JSON.parse(raw)
    } catch {
      sections = [{ title: `Introduction to ${subject}`, content: raw }]
    }

    if (!Array.isArray(sections) || sections.length === 0 || sections.length > 50) {
      throw new Error('No sections returned from AI')
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const dbHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    }

    const sectionRows = sections.map((s, i) => ({
      section_id: crypto.randomUUID(),
      document_id: documentId,
      user_id: userId,
      section_index: i,
      title: String(s.title ?? `Section ${i + 1}`).slice(0, 500),
      content: String(s.content ?? '').slice(0, 50000),
      quiz_passed: false,
      best_score: 0,
      attempt_count: 0,
      created_at: new Date().toISOString(),
    }))

    const insertResp = await fetch(`${supabaseUrl}/rest/v1/document_sections`, {
      method: 'POST',
      headers: { ...dbHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify(sectionRows),
    })

    if (!insertResp.ok) {
      const err = await insertResp.text()
      throw new Error(`Failed to insert sections: ${err}`)
    }

    await updateDocumentStatus(documentId, 'ready', {
      section_count: sections.length,
      processed_at: new Date().toISOString(),
    })

    res.json({ success: true, sectionCount: sections.length })
  } catch (error) {
    try { await updateDocumentStatus(req.body?.documentId, 'failed') } catch {}
    res.status(500).json({ error: error.message })
  }
}