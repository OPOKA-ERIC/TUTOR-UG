import Anthropic from "npm:@anthropic-ai/sdk";
import {
  ApiError, corsHeaders, handlePreflight, requireUser, json,
  isNonEmptyString, isOptionalString,
} from "../_shared/security.ts";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_KEY") });

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const CORS = corsHeaders(req);

  try {
    requireUser(req);

    const body = await req.json();
    const { message, subject, userName } = body;

    if (!isNonEmptyString(message, 2000)) throw new ApiError(400, "Message is required.");
    if (!isOptionalString(subject, 120)) throw new ApiError(400, "Invalid subject.");
    if (!isOptionalString(userName, 120)) throw new ApiError(400, "Invalid user name.");

    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 10,
      system: `You are a content moderator for TutorUG, an academic platform for Ugandan students.
Your ONLY job: decide if a message is academic/educational or not.
Academic = questions, explanations, discussions about school subjects, study tips, homework help.
Non-academic = insults, romantic/sexual content, spam, hate speech, completely off-topic chat.
Reply with ONLY the word: ALLOW or BLOCK`,
      messages: [{ role: "user", content: `Room subject: ${subject}\nMessage: "${message}"` }],
    });

    const decision = response.content[0].type === "text" ? response.content[0].text.trim().toUpperCase() : "ALLOW";
    const allowed = decision.includes("ALLOW");

    return json({ allowed, flagged: !allowed }, 200, CORS);
  } catch (error: any) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status, CORS);
    return json({ allowed: true, flagged: false }, 200, CORS);
  }
});