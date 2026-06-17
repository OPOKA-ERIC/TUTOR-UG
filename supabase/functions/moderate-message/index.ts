import Anthropic from 'npm:@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_KEY') })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { message, subject, userName } = await req.json()

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

    return new Response(JSON.stringify({ allowed, flagged: !allowed }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ allowed: true, flagged: false }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
