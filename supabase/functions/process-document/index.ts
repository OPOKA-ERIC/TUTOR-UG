import Anthropic from "npm:@anthropic-ai/sdk@0.20.0";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_KEY") });
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const headers = {
  "apikey": supabaseKey,
  "Authorization": `Bearer ${supabaseKey}`,
  "Content-Type": "application/json",
};

async function updateDocumentStatus(documentId: string, status: string, extra: object = {}) {
  await fetch(`${supabaseUrl}/rest/v1/documents?document_id=eq.${documentId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status, ...extra }),
  });
}

Deno.serve(async (req) => {
  const { documentId, fileName, userId, subject, extractedText } = await req.json();

  try {
    // Use the text extracted on the Android side
    // Fall back to filename/subject hint if extraction yielded nothing
    const textContent = (extractedText && extractedText.trim().length > 50)
      ? extractedText.trim().slice(0, 12000)
      : `Document: ${fileName}\nSubject: ${subject}\nNote: Could not extract text. Please create educational content based on the subject "${subject}".`;

    const hasRealContent = extractedText && extractedText.trim().length > 50;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 3000,
      system: `You are an expert educational content analyzer for Ugandan students.
${hasRealContent
  ? "Break the provided document content into 3-5 logical learning sections based on what is actually written in the document."
  : "Create 3-5 educational learning sections for the given subject."}
Return ONLY a valid JSON array. No extra text before or after.
Each item must have exactly these fields:
- title: string (section heading, plain text no markdown)
- content: string (detailed educational explanation, at least 3 paragraphs)

FORMATTING RULES for the content field:
- Use ## for main topic headings
- Use ### for subtopic headings
- Use **bold** for key terms, definitions, and critical points
- Use *italic* for subtopic names mentioned inline within paragraphs
- Use numbered lists (1. 2. 3.) for steps or sequences
- Use bullet dashes (- ) for non-sequential lists
- Separate paragraphs with a blank line`,
      messages: [{
        role: "user",
        content: hasRealContent
          ? `Analyze this document content and create learning sections for a student studying ${subject}:\n\n${textContent}`
          : `Create learning sections for a student studying ${subject}. Document name: ${fileName}`,
      }],
    });

    // Parse sections
    let sections: Array<{ title: string; content: string }> = [];
    try {
      const text = response.content[0].text.trim();
      const match = text.match(/\[[\s\S]*\]/);
      sections = match ? JSON.parse(match[0]) : JSON.parse(text);
    } catch {
      sections = [{
        title: `Introduction to ${subject}`,
        content: response.content[0].text,
      }];
    }

    if (!Array.isArray(sections) || sections.length === 0) {
      throw new Error("No sections returned from AI");
    }

    // Insert sections into document_sections table
    const sectionRows = sections.map((s, i) => ({
      section_id: crypto.randomUUID(),
      document_id: documentId,
      user_id: userId,
      section_index: i,
      title: s.title ?? `Section ${i + 1}`,
      content: s.content ?? "",
      quiz_passed: false,
      best_score: 0,
      attempt_count: 0,
      created_at: new Date().toISOString(),
    }));

    const insertResp = await fetch(`${supabaseUrl}/rest/v1/document_sections`, {
      method: "POST",
      headers: { ...headers, "Prefer": "return=minimal" },
      body: JSON.stringify(sectionRows),
    });

    if (!insertResp.ok) {
      const err = await insertResp.text();
      throw new Error(`Failed to insert sections: ${err}`);
    }

    await updateDocumentStatus(documentId, "ready", {
      section_count: sections.length,
      processed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, sectionCount: sections.length }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    await updateDocumentStatus(documentId, "failed");
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
