import Anthropic from "npm:@anthropic-ai/sdk@0.20.0";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_KEY") });

function buildSystemPrompt(userProfile: any, districtContext: string): string {
  return `You are TutorUG, an AI tutor for Ugandan students helping ${userProfile.name}, a ${userProfile.educationLevel} student from ${userProfile.district}.

LOCALIZATION RULES:
- Use ONLY Ugandan context in ALL questions and examples
- Reference real places and names from ${userProfile.district}
- Use UGX (Uganda Shillings) for money examples

${districtContext}`;
}

Deno.serve(async (req) => {
  try {
    const { sectionContent, userProfile, districtContext } = await req.json();

    const systemPrompt = buildSystemPrompt(userProfile, districtContext);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt + "\n\nGenerate 3-5 multiple choice quiz questions based on the section content. Use local Ugandan context in questions. Return ONLY a valid JSON array with no extra text. Each item must have: question (string), options (array of exactly 4 strings), correctIndex (number 0-3), explanation (string).",
      messages: [{
        role: "user",
        content: `Generate quiz questions for this section:\n\n${sectionContent}`,
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

    return new Response(
      JSON.stringify({ questions }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
