import Anthropic from 'npm:@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_KEY') })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { topic, userProfile, districtContext, conversationHistory } = await req.json()

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
          { role: 'user' as const, content: `The student has a follow-up question. Continue the podcast with 4-6 more exchanges covering this: "${topic}"` },
        ]
      : [{ role: 'user' as const, content: `Generate a podcast episode about: "${topic}"` }]

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    let script
    const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
    try {
      script = JSON.parse(raw)
    } catch {
      const match = raw.match(/\[[\s\S]*\]/)
      script = match ? JSON.parse(match[0]) : []
    }

    return new Response(JSON.stringify({ script }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
