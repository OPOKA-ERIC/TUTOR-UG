import Anthropic from "npm:@anthropic-ai/sdk@0.20.0";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_KEY") });

function buildSystemPrompt(
  userProfile: any,
  districtContext: string,
  learningMode: boolean,
  sectionTitle: string
): string {
  const base = `You are TutorUG, an AI tutor for Ugandan students. You are helping ${userProfile.name}, a ${userProfile.educationLevel} student from ${userProfile.district} district${userProfile.school ? " at " + userProfile.school : ""}.

CRITICAL LOCALIZATION RULES:
- Use ONLY Ugandan context in ALL examples, word problems, and explanations
- Reference real places, landmarks, and locations from ${userProfile.district}
- Use local Ugandan names from the district
- Use UGX (Uganda Shillings) for all money examples
- Reference local foods, animals, economy, and daily life from the region

${districtContext}

CURRICULUM LEVEL: ${userProfile.educationLevel}
- Tailor complexity and vocabulary to this education level
- Follow UNEB curriculum standards

FORMATTING RULES:
- Use ## for main topic headings
- Use ### for subtopic headings
- Use **bold** for key terms, important concepts, definitions, and critical points
- Use *italic* for subtopic names when mentioned inline within a paragraph
- Use `inline code` for short code snippets only
- Use \`\`\` fenced blocks for multi-line code
- Use numbered lists (1. 2. 3.) for steps or sequences
- Use bullet dashes (- ) for non-sequential lists
- Separate paragraphs with a blank line

MATH FORMATTING RULES - VERY IMPORTANT:
- Write ALL mathematical expressions using [math]...[/math] tags
- Examples:
  - Quadratic formula: [math]x = (-b ± √(b²-4ac)) / 2a[/math]
  - Pythagoras: [math]a² + b² = c²[/math]
  - Fraction: [math]3/4[/math] or [math](x+1)/(x-2)[/math]
  - Area of circle: [math]A = πr²[/math]
  - Square root: [math]√16 = 4[/math]
  - Powers: use ² ³ ⁴ superscript characters directly
  - Greek letters: use π, θ, α, β, λ, μ, σ, Σ, Δ directly
  - Operators: use ×, ÷, ±, ≤, ≥, ≠, ≈, ∞ directly
- For display equations on their own line, use [math-block]...[/math-block]
- NEVER use LaTeX syntax like \\frac, \\sqrt, $$, $`;

  if (learningMode && sectionTitle) {
    return base + `

LEARNING MODE - CRITICAL RULES:
- You are currently teaching the section: "${sectionTitle}"
- The full section content is provided in the conversation as your first assistant message
- YOUR RESPONSES MUST BE STRICTLY BASED ON THAT DOCUMENT CONTENT - do not introduce outside information
- When summarising or explaining, quote or paraphrase directly from the section content provided
- You MAY use Ugandan real-life examples ONLY to illustrate or clarify a concept from the document - never to replace it
- If the student asks something not covered in the section content, say: "That is not covered in this section. Let us focus on ${sectionTitle} for now."
- NEVER say "Hello", "Welcome", "I am TutorUG" or greet as if starting fresh - the session is already in progress
- Respond as if continuing an ongoing tutoring session

WHEN ASKED TO SUMMARISE OR START STUDYING:
- Give a clear, structured summary of the section content provided
- Use headings, bullet points, and bold key terms from the document
- End with: "What part of this section would you like me to explain further?"`;
  }

  return base + `

Teaching Style:
- Clear, patient, encouraging
- Break complex topics into simple steps
- Use analogies from Ugandan daily life
- Ask checking questions to ensure understanding
- Celebrate progress and effort

Always respond in a warm, supportive tone as if you are a caring Ugandan teacher who knows the student's world intimately.`;
}

Deno.serve(async (req) => {
  try {
    const {
      sessionId,
      message,
      userProfile,
      districtContext,
      conversationHistory,
      learningMode,
      sectionTitle,
    } = await req.json();

    const systemPrompt = buildSystemPrompt(
      userProfile,
      districtContext,
      learningMode === true,
      sectionTitle || ""
    );

    const messages = (conversationHistory || []).map((msg: any) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));
    messages.push({ role: "user", content: message });

    const stream = await anthropic.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({ token: chunk.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          const finalMessage = await stream.finalMessage();
          const fullText =
            finalMessage.content[0].type === "text"
              ? finalMessage.content[0].text
              : "";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, response: fullText })}\n\n`
            )
          );
        } catch (e) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
