import Anthropic from "npm:@anthropic-ai/sdk@0.20.0";
import {
  ApiError, corsHeaders, handlePreflight, requireUser, json,
  isNonEmptyString, isPlainObject, isOptionalString,
} from "../_shared/security.ts";

function buildSystemPrompt(userProfile: any, districtContext: string): string {
  return `You are TutorUG, an AI tutor for Ugandan students helping ${userProfile.name}, a ${userProfile.educationLevel} student from ${userProfile.district}.

LOCALIZATION RULES:
- Use ONLY Ugandan context in ALL questions and examples
- Reference real places and names from ${userProfile.district}
- Use UGX (Uganda Shillings) for money examples

${districtContext}`;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const CORS = corsHeaders(req);

  try {
    requireUser(req);

    const apiKey = Deno.env.get("ANTHROPIC_KEY");
    if (!apiKey) throw new ApiError(500, "ANTHROPIC_KEY secret not set in Supabase");

    const anthropic = new Anthropic({ apiKey });
    const body = await req.json();
    const { sectionContent, userProfile, districtContext } = body;

    if (!isNonEmptyString(sectionContent, 60000)) throw new ApiError(400, "Section content is required.");
    if (!isPlainObject(userProfile) || !isNonEmptyString(userProfile.name, 120)) {
      throw new ApiError(400, "A valid user profile is required.");
    }
    if (!isOptionalString(districtContext, 2000)) throw new ApiError(400, "Invalid district context.");

    const systemPrompt = buildSystemPrompt(userProfile, districtContext ?? "");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt + "\n\nGenerate 3-5 multiple choice quiz questions based on the section content. Use local Ugandan context in questions. Return ONLY a valid JSON array with no extra text. Each item must have: question (string), options (array of exactly 4 strings), correctIndex (number 0-3), explanation (string).",
      messages: [{
        role: "user",
        content: `Generate quiz questions for this section:\n\n${String(sectionContent).slice(0, 60000)}`,
      }],
    });

    let questions;
    try {
      questions = JSON.parse(response.content[0].text);
    } catch {
      const match = response.content[0].text.match(/\[.*\]/s);
      if (!match) throw new Error("Could not parse quiz questions");
      questions = JSON.parse(match[0]);
    }

    if (!Array.isArray(questions) || questions.length > 20) {
      throw new ApiError(500, "Invalid quiz response from AI.");
    }

    return json({ questions }, 200, CORS);
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    return json({ error: error.message }, status, CORS);
  }
});