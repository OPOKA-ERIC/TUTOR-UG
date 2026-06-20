import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const apiKey = process.env.ANTHROPIC_KEY
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_KEY not set' })

    const anthropic = new Anthropic({ apiKey })
    const { message, subject, userName } = req.body

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 10,
      system: `You are a content moderator for TutorUG, an academic platform for Ugandan students.
Your ONLY job: decide if a message is academic/educational or not.
Academic = questions, explanations, discussions about school subjects, study tips, homework help.
Non-academic = insults, romantic/sexual content, spam, hate speech, completely off-topic chat.
Reply with ONLY the word: ALLOW or BLOCK`,
      messages: [{ role: 'user', content: `Room subject: ${subject}\nMessage: "${message}"` }],
    })

    const decision = response.content[0].type === 'text' ? response.content[0].text.trim().toUpperCase() : 'ALLOW'
    const allowed = decision.includes('ALLOW')

    res.json({ allowed, flagged: !allowed })
  } catch {
    res.json({ allowed: true, flagged: false })
  }
}
