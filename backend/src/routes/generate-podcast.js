import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const apiKey = process.env.ANTHROPIC_KEY
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_KEY not set' })

    const anthropic = new Anthropic({ apiKey })
    const { topic, userProfile, districtContext, conversationHistory } = req.body
    const isFollowUp = conversationHistory && conversationHistory.length > 0

    const systemPrompt = `You are producing a TutorUG Learning Podcast for ${userProfile.name}, a ${userProfile.educationLevel} student from ${userProfile.district} district in Uganda.

The podcast has TWO speakers:
- HOST: TutorUG AI — enthusiastic, knowledgeable, uses simple clear language with Ugandan examples
- STUDENT: ${userProfile.name} — curious, asks good questions, relates to Ugandan context

LOCALIZATION RULES:
- Use ONLY Ugandan examples, names, places, and currency (UGX)
- Reference real places in ${userProfile.district}
- Follow UNEB ${userProfile.educationLevel} curriculum

OUTPUT FORMAT — return ONLY a valid JSON array, no other text:
[
  { "speaker": "HOST", "text": "..." },
  { "speaker": "STUDENT", "text": "..." },
  ...
]

PODCAST RULES:
- 8-12 exchanges (HOST and STUDENT alternating)
- Start with HOST giving a warm Ugandan greeting and introducing the topic
- Make it conversational and engaging, not a lecture
- Include at least one real-world Ugandan example
- End with HOST summarizing key points and encouraging the student
- Each segment should be 2-4 sentences max (for natural TTS playback)`

    const messages = isFollowUp
      ? [
          ...conversationHistory,
          { role: 'user', content: `The student has a follow-up question. Continue the podcast with 4-6 more exchanges covering this: "${topic}"` },
        ]
      : [{ role: 'user', content: `Generate a podcast episode about: "${topic}"` }]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
    let script
    try {
      script = JSON.parse(raw)
    } catch {
      const match = raw.match(/\[[\s\S]*\]/)
      script = match ? JSON.parse(match[0]) : []
    }

    res.json({ script })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
