package com.tutorug.app.util

/**
 * Cleans AI output before it reaches the text-to-speech engine.
 *
 * The chat system prompt already forbids emoji and markdown, but models still slip
 * through often enough that it cannot be trusted on its own. Speaking those aloud is
 * worse than ugly: engines vocalise "asterisk asterisk bold", "hash hash heading",
 * "smiling face with smiling eyes", so the read-aloud path — an accessibility
 * feature for students — degrades into noise.
 *
 * This only affects speech. The on-screen bubble keeps its markdown, because the
 * lesson/document renderer ([com.tutorug.app.ui.screens.FormattedAIText]) needs it
 * for code blocks and maths.
 */
object SpeechSanitizer {

    // Fenced code blocks: drop the fence markers but keep the content, since a
    // worked example is still worth hearing. The content itself gets cleaned below.
    private val FENCED_CODE = Regex("```[a-zA-Z0-9_+-]*\\s*\\n(.*?)```", RegexOption.DOT_MATCHES_ALL)
    private val UNCLOSED_FENCE = Regex("```[a-zA-Z0-9_+-]*\\s*\\n?", RegexOption.DOT_MATCHES_ALL)

    // TutorUG's own maths delimiters — meaningless to a speech engine.
    private val MATH_MARKUP = Regex("\\[/?math-block]|\\$\\$|\\\\\\[|\\\\\\]|\\\\\\(|\\\\\\)")

    private val INLINE_CODE = Regex("`([^`]*)`")
    private val LINK = Regex("\\[([^\\]]*)]\\(([^)]*)\\)")

    private val BOLD = Regex("\\*\\*([^*]+?)\\*\\*|__([^_]+?)__")
    private val ITALIC = Regex("(?<![*_\\w])\\*([^*\\n]+?)\\*(?![*_\\w])|(?<![*_\\w])_([^_\\n]+?)_(?![*_\\w])")

    private val HEADING = Regex("^[ \\t]*#{1,6}[ \\t]*", RegexOption.MULTILINE)
    private val DIVIDER = Regex("^[ \\t]*(?:[-*_][ \\t]*){3,}$", RegexOption.MULTILINE)
    // Requires trailing whitespace so hyphenated words ("three-dimensional",
    // "minus 5") and negative numbers keep their leading character.
    private val BULLET = Regex("^[ \\t]*[-*+•‣▪▸·–—]+[ \\t]+", RegexOption.MULTILINE)
    private val QUOTE_MARK = Regex("^[ \\t]*(?:>|\\\\)[ \\t]?", RegexOption.MULTILINE)
    private val TABLE_PIPE = Regex("[ \\t]*\\|[ \\t]*")

    // Emoji and decorative symbols. Deliberately NOT a surrogate-pair range:
    // java.util.regex matches code points, so a class like [\uD800-\uDFFF] silently
    // never fires against a real emoji. \p{So} is what actually catches them.
    // Currency (\p{Sc}) and letters are deliberately left alone so "UGX 5,000" and
    // "x^2" survive intact.
    private val EMOJI = Regex(
        "\\p{So}" +                 // most emoji, stars, dingbats, check marks
        "|[\\x{1F3FB}-\\x{1F3FF}]" +  // skin tone modifiers
        "|[\\x{1F1E6}-\\x{1F1FF}]" +  // regional indicators (flags)
        "|[\\u2190-\\u21FF]" +         // arrows
        "|[\\u2300-\\u27BF]" +         // misc technical and dingbats
        "|[\\u2B00-\\u2BFF]" +         // misc symbols and arrows
        "|[\\u25A0-\\u25FF]" +         // geometric shapes
        "|[\\u00A9\\u00AE\\u00B7\\u203C\\u2049\\u2122\\u2139\\u3030\\u303D]"
    )
    private val VARIATION_SELECTOR = Regex("[\\uFE00-\\uFE0F\\u200D\\u20E3]")
    private val BULLET_GLYPH = Regex("[\\u2022\\u25CF\\u25E6\\u2043\\u2219\\u00B7\\u25AA\\u2027]")

    private val BLANK_RUN = Regex("\\n{3,}")
    private val SPACE_RUN = Regex("[ \\t]{2,}")
    private val LINE_EDGE_WS = Regex("(?m)^[ \\t]+|[ \\t]+$")

    /**
     * Returns [text] reduced to plain, speakable prose.
     *
     * Sentence boundaries are preserved so the engine keeps its natural pacing;
     * only decoration, not structure, is removed. Returns an empty string when
     * nothing speakable is left.
     */
    fun clean(text: String): String {
        if (text.isBlank()) return ""

        var out = text
        out = FENCED_CODE.replace(out) { it.groupValues.getOrElse(1) { "" } }
        out = UNCLOSED_FENCE.replace(out, "")
        out = MATH_MARKUP.replace(out, " ")

        out = LINK.replace(out) { it.groupValues.getOrElse(1) { "" } }
        out = INLINE_CODE.replace(out) { it.groupValues.getOrElse(1) { "" } }
        out = BOLD.replace(out) { it.groupValues.drop(1).firstOrNull { g -> g.isNotEmpty() } ?: "" }
        out = ITALIC.replace(out) { it.groupValues.drop(1).firstOrNull { g -> g.isNotEmpty() } ?: "" }

        out = HEADING.replace(out, "")
        out = DIVIDER.replace(out, "")
        out = QUOTE_MARK.replace(out, "")
        out = TABLE_PIPE.replace(out, " ")
        out = BULLET.replace(out, "")

        out = EMOJI.replace(out, "")
        out = VARIATION_SELECTOR.replace(out, "")
        out = BULLET_GLYPH.replace(out, "")

        // A line that was only decoration becomes an empty line; collapse the runs
        // those leave behind so the engine does not insert long pauses.
        out = LINE_EDGE_WS.replace(out, "")
        out = BLANK_RUN.replace(out, "\n\n")
        out = SPACE_RUN.replace(out, " ")
        out = out.trim()

        return out
    }

    /** True when there is something worth sending to the engine. */
    fun hasSpeech(text: String): Boolean = clean(text).isNotBlank()
}
