import Anthropic from '@anthropic-ai/sdk'
import { isNonEmptyString, isPlainObject, isArrayOrEmpty, isOptionalString, fail } from '../utils/validate.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const apiKey = process.env.ANTHROPIC_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_KEY not set' })
    }

    const { message, userProfile, conversationHistory, learningMode, sectionTitle } = req.body

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
    const base = `You are TutorUG, an AI tutor for Ugandan students helping ${userProfile.name}, a ${userProfile.educationLevel} student from ${userProfile.district} district.
Use ONLY Ugandan context, names, places, UGX currency. Follow UNEB curriculum standards.
Use **bold** for key terms. Use ## for headings. Use numbered lists for steps.`

    const system = learningMode && sectionTitle
      ? base + `\n\nYou are teaching: "${sectionTitle}". Answer directly based on section content.`
      : base + `\n\nBe clear, patient and encouraging. Use analogies from Ugandan daily life.`

    const messages = [
      ...(conversationHistory || []).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 4000) })),
      { role: 'user', content: message.slice(0, 20000) },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system,
      messages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.write(`data: ${JSON.stringify({ token: text })}\n\n`)
    res.write(`data: ${JSON.stringify({ done: true, response: text })}\n\n`)
    res.end()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}