import Anthropic from "npm:@anthropic-ai/sdk";
import {
  ApiError, corsHeaders, handlePreflight, requireUser, json,
  isNonEmptyString, isPlainObject, isArrayOrEmpty, isOptionalString, checkRateLimit,
} from "../_shared/security.ts";

// ── Web search ───────────────────────────────────────────────────────────
// Anthropic runs the search server-side, so there is no search API key to
// provision. Claude decides when to search; we only cap how many searches a
// single message may trigger and steer it from the system prompt.
//
// Docs: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
const WEB_SEARCH_TOOL_TYPE = "web_search_20250305";
const MAX_SEARCHES_PER_MESSAGE = 5;
// Guards the per-message search cap above: no single user can make this
// endpoint issue more than ~60 * 5 searches an hour, which bounds the bill.
const SEARCH_MESSAGES_PER_HOUR = 60;

type Source = { url: string; title: string; citedText: string };

// Preamble Claude emits before searching, e.g. "I'll search for that." It is
// never useful to a student, so we drop it when real content follows.
const SEARCH_PREAMBLE =
  /^\s*(i'?ll|i will|let me|let'?s|okay,? i'?ll|ok,? i'?ll)\b[^.]*\b(search|look|check|find|browse|fetch|see)\b[^.]*[.!]?\s*$/i;

function isSafePlaceName(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z][A-Za-z\s'.-]{1,40}$/.test(v.trim());
}

// Localises results to the student. country/timezone are constants; city is only
// passed when it looks like a real place name, because a malformed value makes
// the API reject the whole request with a 400.
function searchLocation(district: unknown): Record<string, string> {
  const loc: Record<string, string> = { country: "UG", timezone: "Africa/Kampala" };
  if (isSafePlaceName(district)) loc.city = district.trim();
  return loc;
}

function webSearchTool(district: unknown) {
  return {
    type: WEB_SEARCH_TOOL_TYPE,
    name: "web_search",
    max_uses: MAX_SEARCHES_PER_MESSAGE,
    user_location: searchLocation(district),
  };
}

// With search enabled the response is a mix of text, server_tool_use and
// web_search_tool_result blocks, so content[0] is usually NOT the answer.
function joinTextBlocks(content: any[]): string {
  const texts: string[] = [];
  for (const block of content) {
    if (block && block.type === "text" && typeof block.text === "string" && block.text.trim()) {
      texts.push(block.text.trim());
    }
  }
  if (texts.length > 1 && texts[0].length <= 240 && SEARCH_PREAMBLE.test(texts[0])) {
    const stripped = texts.slice(1).join("").trim();
    if (stripped) return stripped;
  }
  return texts.join("").trim();
}

function collectSources(content: any[]): Source[] {
  const out: Source[] = [];
  const seen = new Set<string>();
  for (const block of content) {
    if (!block || block.type !== "text" || !Array.isArray(block.citations)) continue;
    for (const c of block.citations) {
      if (!c || c.type !== "web_search_result_location" || typeof c.url !== "string") continue;
      if (!c.url.startsWith("http") || seen.has(c.url)) continue;
      seen.add(c.url);
      out.push({
        url: c.url,
        title: typeof c.title === "string" && c.title.trim() ? c.title.trim() : c.url,
        citedText: typeof c.cited_text === "string" ? c.cited_text.slice(0, 240) : "",
      });
    }
  }
  return out.slice(0, 10);
}

// Web search can be switched off org-wide in the Claude Console, which fails the
// request with a 400. Rather than break chat entirely we retry without the tool.
function isSearchUnavailable(error: any): boolean {
  const msg = String(error?.message || "");
  return /web search/i.test(msg) && /(not enabled|not available|not supported|invalid_request)/i.test(msg);
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const CORS = corsHeaders(req);

  try {
    const { userId } = requireUser(req);

    const apiKey = Deno.env.get("ANTHROPIC_KEY");
    if (!apiKey) throw new ApiError(500, "ANTHROPIC_KEY secret not set in Supabase");

    const anthropic = new Anthropic({ apiKey });
    const body = await req.json();
    const {
      message, userProfile, conversationHistory, learningMode, sectionTitle,
      webSearch, forceSearch,
    } = body;

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

    // Document mode stays grounded on the uploaded section, so search is off there.
    const grounded = Boolean(learningMode && sectionTitle);
    const searchEnabled = webSearch !== false && !grounded;
    const mustSearch = searchEnabled && forceSearch === true;

    if (searchEnabled) {
      await checkRateLimit(`chat-web:${userId}`, SEARCH_MESSAGES_PER_HOUR, 3600);
    }

    // Chat replies are read on screen AND spoken aloud by the app's TTS, so the
    // prompt must not ask for markdown or emoji decoration. This replaces an
    // earlier line that told the model to use **bold**, ## and lists — that
    // instruction was the actual source of the symbol clutter, and appending a
    // rule against it would have left the prompt contradicting itself.
    const formattingRules = `
FORMATTING RULES (strict — apply to every response):
- Never use emojis or emoticons.
- Never use markdown decoration: no **bold**, no # headings, no --- dividers, no bullet symbols (•, -, *) for emphasis.
- Write in plain, natural English sentences and paragraphs, the way a teacher would speak aloud to a student.
- Use plain numbers with a period (1. 2. 3.) only for genuine step-by-step instructions — nothing else.
- Do not use section titles or headings. Just write connected prose.
- Avoid generic, templated-sounding answers. Be specific to what was actually asked, and vary your phrasing naturally.
- These responses may be read aloud by text-to-speech. If it wouldn't sound natural spoken out loud, don't write it.`;

    const base = `You are TutorUG, an AI tutor for Ugandan students helping ${userProfile.name}, a ${level} student from ${userProfile.district} district.
IMPORTANT (never violate): this student's education level is exactly "${userProfile.educationLevel}". Always refer to this exact level and never mention or imply any other class/grade level.${combo}
Use ONLY Ugandan context, names, places, UGX currency. Follow UNEB curriculum standards.${formattingRules}`;

    // How to handle results, shared by every search-enabled turn (forced or automatic).
    // Deliberately not included when search is off: in document mode the tool is
    // withheld, so promising to search — or forbidding the model from saying it
    // cannot — would put a false claim in front of the student.
    const searchConduct = `
When you answer from search results, base the answer only on what the sources actually say, and mention the source name when it helps the student. If sources disagree or look unreliable, say so rather than guessing.
Explain the answer in your own plain words instead of pasting search snippets.
Keep the answer focused on what the student actually asked, without padding it with unrelated background.
Never tell a student that you cannot search the internet. If a search did not give you what you needed, say plainly what is missing rather than claiming that searching is impossible.`;

    const searchRules = !searchEnabled
      ? ""
      : (mustSearch
        ? `\n\nYou must search the web before answering this message, even if you think you already know the answer. Prefer Ugandan and East African sources.`
        : `\n\nYou can search the internet. Search when the answer depends on current or changing facts: exam and test dates, Ugandan government schemes and fees, school announcements, news, or anything that may have changed since your training. Do NOT search for stable knowledge you already have (algebra, science fundamentals, essay structure, study advice) — answer those directly and instantly.`) + searchConduct;

    const system = grounded
      ? base + `\n\nYou are teaching: "${sectionTitle}". Answer directly based on section content.`
      : base + `\n\nBe clear, patient and encouraging. Use analogies from Ugandan daily life.` + searchRules;

    const messages: any[] = [
      ...(conversationHistory || []).map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 4000),
      })),
      { role: "user" as const, content: message.slice(0, 20000) },
    ];

    const request: Record<string, unknown> = {
      model: "claude-haiku-4-5",
      max_tokens: searchEnabled ? 2048 : 1024,
      system,
      messages,
    };
    if (searchEnabled) request.tools = [webSearchTool(userProfile.district)];

    // Content blocks from every round, so text and citations survive a pause_turn.
    const blocks: any[] = [];
    const run = async (): Promise<any> => {
      let response = await anthropic.messages.create(request as any);
      blocks.push(...(response.content || []));
      // A long search turn can be handed back for the server-side loop to finish.
      let guard = 0;
      while (response.stop_reason === "pause_turn" && guard++ < 3) {
        messages.push({ role: "assistant", content: response.content });
        response = await anthropic.messages.create(request as any);
        blocks.push(...(response.content || []));
      }
      return response;
    };

    let response: any;
    try {
      response = await run();
    } catch (err) {
      if (searchEnabled && isSearchUnavailable(err)) {
        delete request.tools;
        blocks.length = 0;
        response = await run();
      } else {
        throw err;
      }
    }

    const text = joinTextBlocks(blocks);
    const sources = searchEnabled ? collectSources(blocks) : [];

    if (!text) throw new ApiError(502, "The tutor could not produce a reply. Please try again.");

    const encoder = new TextEncoder();
    const bodyOut = encoder.encode(
      (searchEnabled ? `data: ${JSON.stringify({ searching: true })}\n\n` : "") +
      `data: ${JSON.stringify({ token: text })}\n\n` +
      `data: ${JSON.stringify({ done: true, response: text, sources, searched: sources.length > 0 })}\n\n`
    );

    return new Response(bodyOut, {
      headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    return json({ error: error.message }, status, CORS);
  }
});
