import Anthropic from '@anthropic-ai/sdk'
import { isNonEmptyString, isPlainObject, isArrayOrEmpty, fail } from '../utils/validate.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const apiKey = process.env.ANTHROPIC_KEY
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_KEY not set' })

    const { topic, userProfile, districtContext, conversationHistory, sourceMaterial } = req.body

    if (!isNonEmptyString(topic, 2000)) return fail(res, 'Topic is required.')
    if (!isPlainObject(userProfile) || !isNonEmptyString(userProfile.name, 120)) {
      return fail(res, 'A valid user profile is required.')
    }
    if (conversationHistory !== undefined && !isArrayOrEmpty(conversationHistory, 200)) {
      return fail(res, 'Conversation history is invalid.')
    }
    if (sourceMaterial !== undefined && !isNonEmptyString(sourceMaterial, 12000)) {
      return fail(res, 'Source material is invalid.')
    }

    const anthropic = new Anthropic({ apiKey })
    const isFollowUp = conversationHistory && conversationHistory.length > 0
    const hasSources = !!sourceMaterial && sourceMaterial.trim().length > 0

    const systemPrompt = `You are producing a TutorUG Learning Podcast for ${userProfile.name}, a ${userProfile.educationLevel} student from ${userProfile.district} district in Uganda.

The podcast has TWO speakers:
- HOST: TutorUG AI — enthusiastic, knowledgeable, uses simple clear language with Ugandan examples
- STUDENT: ${userProfile.name} — curious, asks good questions, relates to Ugandan context

LOCALIZATION RULES:
- Use ONLY Ugandan examples, names, places, and currency (UGX)
- Reference real places in ${userProfile.district}
- Follow UNEB ${userProfile.educationLevel} curriculum

WRITING RULES — this is audio, not an essay:
- Write for the EAR. Short sentences. One idea per turn.
- NEVER write stage directions, sound effects, or text like "[laughs]" or "pause".
- NEVER write equations, bullet points, or markdown. Spell things out: "x squared plus b x plus c equals zero."
- Write numbers the way they are spoken: "eighteen thousand shillings", not "UGX 18,000".
- No emoji, no asterisks, no quotation marks around speech.
- Each turn must be 1-3 sentences so the voice never sounds like it is lecturing.

DISCUSSION RULES — make it sound like two people who know each other:
- The HOST asks a real question; the STUDENT answers partly, then asks back.
- The HOST builds on what the STUDENT just said. Do not restart the topic each turn.
- Let them make one genuine connection to something the student already struggled with.
- Allow one moment of light humour or a relatable Ugandan aside.
- Avoid robotic openers. Do not start every HOST turn with "Great question" or "Excellent question".

ACCURACY RULES:
- Only state facts you are confident about. This is a school exam-prep tool.
- If you are unsure of a detail, have the HOST say it needs checking rather than inventing it.
- Never invent a past-paper question, mark scheme, or exam date.${hasSources ? `

GROUNDING — your non-negotiable source:
The student has uploaded their own material. Base the episode on it.
- Ground every claim in the SOURCE MATERIAL below.
- Refer to their actual notes by name where it helps ("your Biology notes on photosynthesis").
- Do not introduce outside topics that are not supported by their material.
- If the SOURCE MATERIAL does not cover part of the requested topic, say so in the HOST turn and tell the student what to revise.

SOURCE MATERIAL:
"""
${sourceMaterial}
"""` : `

GROUNDING:
No uploaded material was supplied, so anchor the episode in the UNEB ${userProfile.educationLevel} syllabus and standard exam technique for this topic.`}

OUTPUT FORMAT — return ONLY a valid JSON array, no other text:
[
  { "speaker": "HOST", "text": "..." },
  { "speaker": "STUDENT", "text": "..." },
  ...
]

PODCAST RULES:
- 10-14 turns, strictly alternating HOST and STUDENT, always starting with HOST
- Start with HOST welcoming the student by name and naming the exact topic
- End with HOST giving a concrete next action, not a generic encouragement`

    const messages = isFollowUp
      ? [
          ...conversationHistory.slice(0, 200),
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

    if (!Array.isArray(script) || script.length > 50) {
      return fail(res, 'Invalid podcast script from AI.', 500)
    }

    const clean = script
      .map((seg) => ({
        speaker: String(seg?.speaker || 'HOST').toUpperCase() === 'STUDENT' ? 'STUDENT' : 'HOST',
        text: String(seg?.text || '').trim(),
      }))
      .filter((seg) => seg.text.length > 0)

    if (clean.length === 0) {
      return fail(res, 'Podcast script was empty.', 500)
    }

    res.json({ script: clean })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}