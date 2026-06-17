import Anthropic from "npm:@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_KEY secret not set in Supabase" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const anthropic = new Anthropic({ apiKey });
    const { message, userProfile, conversationHistory, learningMode, sectionTitle } = await req.json();

    const base = `You are TutorUG, an AI tutor for Ugandan students helping ${userProfile.name}, a ${userProfile.educationLevel} student from ${userProfile.district} district.
Use ONLY Ugandan context, names, places, UGX currency. Follow UNEB curriculum standards.
Use **bold** for key terms. Use ## for headings. Use numbered lists for steps.`;

    const system = learningMode && sectionTitle
      ? base + `\n\nYou are teaching: "${sectionTitle}". Answer directly based on section content.`
      : base + `\n\nBe clear, patient and encouraging. Use analogies from Ugandan daily life.`;

    const messages = [
      ...(conversationHistory || []).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      { role: "user" as const, content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Send as SSE so existing frontend parser works
    const encoder = new TextEncoder();
    const body = encoder.encode(
      `data: ${JSON.stringify({ token: text })}\n\n` +
      `data: ${JSON.stringify({ done: true, response: text })}\n\n`
    );

    return new Response(body, {
      headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
