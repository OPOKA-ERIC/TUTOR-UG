import Anthropic from '@anthropic-ai/sdk'
import { isNonEmptyString, isPlainObject, isOptionalString, fail } from '../utils/validate.js'

function buildSystemPrompt(userProfile, districtContext) {
  return `You are TutorUG, an AI tutor for Ugandan students helping ${userProfile.name}, a ${userProfile.educationLevel} student from ${userProfile.district}.

LOCALIZATION RULES:
- Use ONLY Ugandan context in ALL questions and examples
- Reference real places and names from ${userProfile.district}
- Use UGX (Uganda Shillings) for money examples

${districtContext}`
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const apiKey = process.env.ANTHROPIC_KEY
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_KEY not set' })

    const { sectionContent, userProfile, districtContext } = req.body

    if (!isNonEmptyString(sectionContent, 60000)) return fail(res, 'Section content is required.')
    if (!isPlainObject(userProfile) || !isNonEmptyString(userProfile.name, 120)) {
      return fail(res, 'A valid user profile is required.')
    }
    if (!isOptionalString(districtContext, 2000)) return fail(res, 'Invalid district context.')

    const anthropic = new Anthropic({ apiKey })
    const systemPrompt = buildSystemPrompt(userProfile, districtContext)

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt + '\n\nGenerate 3-5 multiple choice quiz questions based on the section content. Use local Ugandan context in questions. Return ONLY a valid JSON array with no extra text. Each item must have: question (string), options (array of exactly 4 strings), correctIndex (number 0-3), explanation (string).',
      messages: [{
        role: 'user',
        content: `Generate quiz questions for this section:\n\n${sectionContent.slice(0, 60000)}`,
      }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    let questions
    try {
      questions = JSON.parse(raw)
    } catch {
      const match = raw.match(/\[.*\]/s)
      if (!match) throw new Error('Could not parse quiz questions')
      questions = JSON.parse(match[0])
    }

    if (!Array.isArray(questions) || questions.length > 20) {
      return fail(res, 'Invalid quiz response from AI.', 500)
    }

    res.json({ questions })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}