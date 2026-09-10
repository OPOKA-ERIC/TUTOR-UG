import Anthropic from "npm:@anthropic-ai/sdk";
import {
  ApiError, corsHeaders, handlePreflight, requireUser, json,
  isNonEmptyString, isPlainObject, isArrayOrEmpty,
} from "../_shared/security.ts";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_KEY") });

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const CORS = corsHeaders(req);

  try {
    requireUser(req);

    const body = await req.json();
    const { topic, userProfile, districtContext, conversationHistory } = body;

    if (!isNonEmptyString(topic, 2000)) throw new ApiError(400, "Topic is required.");
    if (!isPlainObject(userProfile) || !isNonEmptyString(userProfile.name, 120)) {
      throw new ApiError(400, "A valid user profile is required.");
    }
    if (conversationHistory !== undefined && !isArrayOrEmpty(conversationHistory, 200)) {
      throw new ApiError(400, "Conversation history is invalid.");
    }

    const isFollowUp = conversationHistory && conversationHistory.length > 0;

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
- Each segment should be 2-4 sentences max (for natural TTS playback)`;

    const messages = isFollowUp
      ? [
          ...conversationHistory.slice(0, 200),
          { role: "user", content: `The student has a follow-up question. Continue the podcast with 4-6 more exchanges covering this: "${String(topic).slice(0, 2000)}"` },
        ]
      : [{ role: "user", content: `Generate a podcast episode about: "${String(topic).slice(0, 2000)}"` }];

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    let script;
    const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
    try {
      script = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      script = match ? JSON.parse(match[0]) : [];
    }

    if (!Array.isArray(script) || script.length > 50) {
      throw new ApiError(500, "Invalid podcast script from AI.");
    }

    return json({ script }, 200, CORS);
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    return json({ error: error.message }, status, CORS);
  }
});