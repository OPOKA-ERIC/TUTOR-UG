import Anthropic from '@anthropic-ai/sdk'
import { isNonEmptyString, isPlainObject, isArrayOrEmpty, isOptionalString, fail } from '../utils/validate.js'

// Mirrors supabase/functions/send-chat-message. Keep the two in sync.
const WEB_SEARCH_TOOL_TYPE = 'web_search_20250305'
const MAX_SEARCHES_PER_MESSAGE = 5

// Preamble Claude emits before searching, e.g. "I'll search for that."
const SEARCH_PREAMBLE =
  /^\s*(i'?ll|i will|let me|let'?s|okay,? i'?ll|ok,? i'?ll)\b[^.]*\b(search|look|check|find|browse|fetch|see)\b[^.]*[.!]?\s*$/i

function isSafePlaceName(v) {
  return typeof v === 'string' && /^[A-Za-z][A-Za-z\s'.-]{1,40}$/.test(v.trim())
}

function searchLocation(district) {
  const loc = { country: 'UG', timezone: 'Africa/Kampala' }
  if (isSafePlaceName(district)) loc.city = district.trim()
  return loc
}

function webSearchTool(district) {
  return {
    type: WEB_SEARCH_TOOL_TYPE,
    name: 'web_search',
    max_uses: MAX_SEARCHES_PER_MESSAGE,
    user_location: searchLocation(district),
  }
}

// With search enabled the response mixes text, server_tool_use and
// web_search_tool_result blocks, so content[0] is usually NOT the answer.
function joinTextBlocks(content) {
  const texts = []
  for (const block of content || []) {
    if (block && block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
      texts.push(block.text.trim())
    }
  }
  if (texts.length > 1 && texts[0].length <= 240 && SEARCH_PREAMBLE.test(texts[0])) {
    const stripped = texts.slice(1).join('').trim()
    if (stripped) return stripped
  }
  return texts.join('').trim()
}

function collectSources(content) {
  const out = []
  const seen = new Set()
  for (const block of content || []) {
    if (!block || block.type !== 'text' || !Array.isArray(block.citations)) continue
    for (const c of block.citations) {
      if (!c || c.type !== 'web_search_result_location' || typeof c.url !== 'string') continue
      if (!c.url.startsWith('http') || seen.has(c.url)) continue
      seen.add(c.url)
      out.push({
        url: c.url,
        title: typeof c.title === 'string' && c.title.trim() ? c.title.trim() : c.url,
        citedText: typeof c.cited_text === 'string' ? c.cited_text.slice(0, 240) : '',
      })
    }
  }
  return out.slice(0, 10)
}

function isSearchUnavailable(error) {
  const msg = String(error?.message || '')
  return /web search/i.test(msg) && /(not enabled|not available|not supported|invalid_request)/i.test(msg)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const apiKey = process.env.ANTHROPIC_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_KEY not set' })
    }

    const { message, userProfile, conversationHistory, learningMode, sectionTitle, webSearch, forceSearch } = req.body

    if (!isNonEmptyString(message, 20000)) return fail(res, 'Message is required (max 20,000 characters).')
    if (!isPlainObject(userProfile) || !isNonEmptyString(userProfile.name, 120)) {
      return fail(res, 'A valid user profile is required.')
    }
    if (!isOptionalString(userProfile.district, 120) || !isOptionalString(userProfile.educationLevel, 60)) {
      return fail(res, 'Invalid user profile fields.')
    }
    if (conversationHistory !== undefined && !isArrayOrEmpty(conversationHistory, 200)) {
      return fail(res, 'Conversation history is invalid.')
    }

    const anthropic = new Anthropic({ apiKey })
    // Chat replies are read on screen AND spoken aloud by the app's TTS, so the
    // prompt must not ask for markdown or emoji decoration. This replaces an
    // earlier line that told the model to use **bold**, ## and lists — that
    // instruction was the actual source of the symbol clutter, and appending a
    // rule against it would have left the prompt contradicting itself.
    const formattingRules = `
FORMATTING RULES (strict — apply to every response):
- Never use emojis or emoticons.
- Never use markdown decoration: no **bold**, no # headings, no --- dividers, no bullet symbols (•, -, *) for emphasis.
- Write in plain, natural English sentences and paragraphs, the way a teacher would speak aloud to a student.
- Use plain numbers with a period (1. 2. 3.) only for genuine step-by-step instructions — nothing else.
- Do not use section titles or headings. Just write connected prose.
- Avoid generic, templated-sounding answers. Be specific to what was actually asked, and vary your phrasing naturally.
- These responses may be read aloud by text-to-speech. If it wouldn't sound natural spoken out loud, don't write it.`

    const base = `You are TutorUG, an AI tutor for Ugandan students helping ${userProfile.name}, a ${userProfile.educationLevel} student from ${userProfile.district} district.
Use ONLY Ugandan context, names, places, UGX currency. Follow UNEB curriculum standards.${formattingRules}`

    // Document mode stays grounded on the uploaded section, so search is off there.
    const grounded = Boolean(learningMode && sectionTitle)
    const searchEnabled = webSearch !== false && !grounded
    const mustSearch = searchEnabled && forceSearch === true

    // How to handle results, shared by every search-enabled turn (forced or automatic).
    // Deliberately not included when search is off: in document mode the tool is
    // withheld, so promising to search — or forbidding the model from saying it
    // cannot — would put a false claim in front of the student.
    const searchConduct = `
When you answer from search results, base the answer only on what the sources actually say, and mention the source name when it helps the student. If sources disagree or look unreliable, say so rather than guessing.
Explain the answer in your own plain words instead of pasting search snippets.
Keep the answer focused on what the student actually asked, without padding it with unrelated background.
Never tell a student that you cannot search the internet. If a search did not give you what you needed, say plainly what is missing rather than claiming that searching is impossible.`

    const searchRules = !searchEnabled
      ? ''
      : (mustSearch
        ? `\n\nYou must search the web before answering this message, even if you think you already know the answer. Prefer Ugandan and East African sources.`
        : `\n\nYou can search the internet. Search when the answer depends on current or changing facts: exam and test dates, Ugandan government schemes and fees, school announcements, news, or anything that may have changed since your training. Do NOT search for stable knowledge you already have (algebra, science fundamentals, essay structure, study advice) — answer those directly and instantly.`) + searchConduct

    const system = learningMode && sectionTitle
      ? base + `\n\nYou are teaching: "${sectionTitle}". Answer directly based on section content.`
      : base + `\n\nBe clear, patient and encouraging. Use analogies from Ugandan daily life.` + searchRules

    const messages = [
      ...(conversationHistory || []).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 4000) })),
      { role: 'user', content: message.slice(0, 20000) },
    ]

    const request = {
      model: 'claude-haiku-4-5',
      max_tokens: searchEnabled ? 2048 : 1024,
      system,
      messages,
    }
    if (searchEnabled) request.tools = [webSearchTool(userProfile.district)]

    const blocks = []
    const run = async () => {
      let response = await anthropic.messages.create(request)
      blocks.push(...(response.content || []))
      let guard = 0
      while (response.stop_reason === 'pause_turn' && guard++ < 3) {
        messages.push({ role: 'assistant', content: response.content })
        response = await anthropic.messages.create(request)
        blocks.push(...(response.content || []))
      }
      return response
    }

    let response
    try {
      response = await run()
    } catch (err) {
      if (searchEnabled && isSearchUnavailable(err)) {
        delete request.tools
        blocks.length = 0
        response = await run()
      } else {
        throw err
      }
    }

    const text = joinTextBlocks(blocks)
    const sources = searchEnabled ? collectSources(blocks) : []
    if (!text) return fail(res, 'The tutor could not produce a reply. Please try again.', 502)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    if (searchEnabled) res.write(`data: ${JSON.stringify({ searching: true })}\n\n`)
    res.write(`data: ${JSON.stringify({ token: text })}\n\n`)
    res.write(`data: ${JSON.stringify({ done: true, response: text, sources, searched: sources.length > 0 })}\n\n`)
    res.end()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
