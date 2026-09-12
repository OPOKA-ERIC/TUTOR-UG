import Anthropic from "npm:@anthropic-ai/sdk";
import {
  ApiError, corsHeaders, handlePreflight, requireUser, json,
  isNonEmptyString, isPlainObject, isArrayOrEmpty, isOptionalString,
} from "../_shared/security.ts";

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
    const { message, userProfile, conversationHistory, learningMode, sectionTitle } = body;

    if (!isNonEmptyString(message, 20000)) throw new ApiError(400, "Message is required (max 20,000 characters).");
    if (!isPlainObject(userProfile) || !isNonEmptyString(userProfile.name, 120)) {
      throw new ApiError(400, "A valid user profile is required.");
    }
    if (!isOptionalString(userProfile.district, 120) || !isOptionalString(userProfile.educationLevel, 60)) {
      throw new ApiError(400, "Invalid user profile fields.");
    }
    if (userProfile.combination !== undefined && !isOptionalString(userProfile.combination, 120)) {
      throw new ApiError(400, "Invalid user profile fields.");
    }
    if (conversationHistory !== undefined && !isArrayOrEmpty(conversationHistory, 200)) {
      throw new ApiError(400, "Conversation history is invalid.");
    }

    const level = userProfile.educationLevel || "an unspecified level";
    const combo = userProfile.combination ? ` Their combination/subjects are: ${userProfile.combination}.` : "";

    const base = `You are TutorUG, an AI tutor for Ugandan students helping ${userProfile.name}, a ${level} student from ${userProfile.district} district.
IMPORTANT (never violate): this student's education level is exactly "${userProfile.educationLevel}". Always refer to this exact level and never mention or imply any other class/grade level.${combo}
Use ONLY Ugandan context, names, places, UGX currency. Follow UNEB curriculum standards.
Use **bold** for key terms. Use ## for headings. Use numbered lists for steps.`;

    const system = learningMode && sectionTitle
      ? base + `\n\nYou are teaching: "${sectionTitle}". Answer directly based on section content.`
      : base + `\n\nBe clear, patient and encouraging. Use analogies from Ugandan daily life.`;

    const messages = [
      ...(conversationHistory || []).map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 4000),
      })),
      { role: "user" as const, content: message.slice(0, 20000) },
    ];

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    const encoder = new TextEncoder();
    const bodyOut = encoder.encode(
      `data: ${JSON.stringify({ token: text })}\n\n` +
      `data: ${JSON.stringify({ done: true, response: text })}\n\n`
    );

    return new Response(bodyOut, {
      headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    return json({ error: error.message }, status, CORS);
  }
});