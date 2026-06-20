import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const apiKey = process.env.ANTHROPIC_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_KEY not set' })
    }

    const anthropic = new Anthropic({ apiKey })
    const { message, userProfile, conversationHistory, learningMode, sectionTitle } = req.body

    const base = `You are TutorUG, an AI tutor for Ugandan students helping ${userProfile.name}, a ${userProfile.educationLevel} student from ${userProfile.district} district.
Use ONLY Ugandan context, names, places, UGX currency. Follow UNEB curriculum standards.
Use **bold** for key terms. Use ## for headings. Use numbered lists for steps.`

    const system = learningMode && sectionTitle
      ? base + `\n\nYou are teaching: "${sectionTitle}". Answer directly based on section content.`
      : base + `\n\nBe clear, patient and encouraging. Use analogies from Ugandan daily life.`

    const messages = [
      ...(conversationHistory || []).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: message },
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
