package com.tutorug.app.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tutorug.app.data.model.ChatSession
import com.tutorug.app.ui.theme.AppColors
import com.tutorug.app.ui.theme.noRippleClickable
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle as JavaTextStyle
import java.time.temporal.ChronoUnit
import java.util.Locale

// ── Title / date helpers ──────────────────────────────────────────────────────
// Mirrors web/src/components/ChatHistoryModal.tsx so both clients label a
// conversation the same way.

private val GENERIC_TITLE = Regex("^(general|new chat|chat)$", RegexOption.IGNORE_CASE)
private val GREETING = Regex(
    "^(hi+|hii+|hey+|heyy+|hello+|yo+|hiya|howdy|hello there|good\\s+(morning|afternoon|evening|day))\\s*[!.?,]*$",
    RegexOption.IGNORE_CASE
)
private val WHITESPACE = Regex("\\s+")

private fun clip(text: String, max: Int): String {
    val c = text.replace(WHITESPACE, " ").trim()
    return if (c.length > max) c.take(max).trimEnd() + "…" else c
}

fun sessionTitle(session: ChatSession): String {
    val title = session.title.trim()
    // The stored title is just the subject name, so a title equal to the subject
    // tells us nothing — fall through to the opening message instead.
    if (title.isNotEmpty() && !GENERIC_TITLE.matches(title) && !title.equals(session.subject.trim(), true)) {
        return clip(title, 60)
    }
    val raw = session.firstUserMessage.trim()
    if (raw.isNotEmpty()) {
        val cleaned = raw.replace(WHITESPACE, " ").trim()
        if (!GREETING.matches(cleaned)) return clip(cleaned, 40)
        return "New conversation"
    }
    val subject = session.subject.trim()
    if (subject.isNotEmpty() && !GENERIC_TITLE.matches(subject)) return subject
    return "New conversation"
}

/** Secondary line: subject badge plus a relative timestamp. */
fun sessionSubtitle(session: ChatSession): String {
    val parts = mutableListOf<String>()
    val subject = session.subject.trim()
    if (subject.isNotEmpty() && !GENERIC_TITLE.matches(subject)) parts += subject
    formatSessionTime(session.lastMessageAt)?.let { parts += it }
    return parts.joinToString(" · ")
}

private fun parseDate(iso: String?): LocalDate? {
    if (iso.isNullOrBlank()) return null
    return try {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).toLocalDate()
    } catch (e: Exception) {
        null
    }
}

private fun formatSessionTime(iso: String?): String? {
    val date = parseDate(iso) ?: return null
    val days = ChronoUnit.DAYS.between(date, LocalDate.now())
    return when {
        days <= 0L -> "Today"
        days == 1L -> "Yesterday"
        days < 7L -> date.dayOfWeek.getDisplayName(JavaTextStyle.FULL, Locale.getDefault())
        else -> date.format(DateTimeFormatter.ofPattern("MMM d", Locale.getDefault()))
    }
}

private fun groupLabel(iso: String?): String {
    val date = parseDate(iso) ?: return "Older"
    val days = ChronoUnit.DAYS.between(date, LocalDate.now())
    return when {
        days <= 0L -> "Today"
        days == 1L -> "Yesterday"
        days < 7L -> date.dayOfWeek.getDisplayName(JavaTextStyle.FULL, Locale.getDefault())
        else -> date.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.getDefault()))
    }
}

/** Sessions grouped by recency, preserving the incoming newest-first order. */
internal fun groupSessions(
    sessions: List<ChatSession>,
    query: String
): List<Pair<String, List<ChatSession>>> {
    val q = query.trim().lowercase(Locale.getDefault())
    val filtered = if (q.isEmpty()) sessions else sessions.filter { s ->
        val haystack = "${sessionTitle(s)} ${s.subject} ${s.firstUserMessage}".lowercase(Locale.getDefault())
        haystack.contains(q)
    }
    val groups = LinkedHashMap<String, MutableList<ChatSession>>()
    for (session in filtered) {
        groups.getOrPut(groupLabel(session.lastMessageAt)) { mutableListOf() }.add(session)
    }
    return groups.map { (label, list) -> label to list }
}

// ── Screen ────────────────────────────────────────────────────────────────────

@Composable
fun ChatHistoryScreen(
    sessions: List<ChatSession>,
    currentSessionId: String?,
    onSelect: (ChatSession) -> Unit,
    onDelete: (String) -> Unit,
    onClose: () -> Unit
) {
    var query by remember { mutableStateOf("") }
    var pendingDelete by remember { mutableStateOf<ChatSession?>(null) }
    val groups = remember(sessions, query) { groupSessions(sessions, query) }
    val focusRequester = remember { FocusRequester() }

    // This screen exists to search, so the field takes focus immediately
    LaunchedEffect(Unit) { runCatching { focusRequester.requestFocus() } }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(AppColors.surface, AppColors.background)
                )
            )
    ) {
        // ── Pinned header: title, search, close ────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(AppColors.surface)
                .padding(horizontal = 16.dp)
                .padding(top = 14.dp, bottom = 12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Chat History",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.textPrimary,
                    modifier = Modifier.weight(1f)
                )
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .noRippleClickable(onClick = onClose),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Close chat history",
                        tint = AppColors.textMuted,
                        modifier = Modifier.size(19.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .background(AppColors.surfaceInput, RoundedCornerShape(12.dp))
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Search,
                    contentDescription = null,
                    tint = AppColors.textDisabled,
                    modifier = Modifier.size(17.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                BasicTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier
                        .weight(1f)
                        .focusRequester(focusRequester),
                    textStyle = TextStyle(color = AppColors.textPrimary, fontSize = 14.sp),
                    cursorBrush = SolidColor(AppColors.primary),
                    singleLine = true,
                    decorationBox = { inner ->
                        if (query.isEmpty()) {
                            Text("Search chats…", color = AppColors.textDisabled, fontSize = 14.sp)
                        }
                        inner()
                    }
                )
                if (query.isNotEmpty()) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Clear search",
                        tint = AppColors.textDisabled,
                        modifier = Modifier
                            .size(16.dp)
                            .noRippleClickable { query = "" }
                    )
                }
            }
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(AppColors.divider)
        )

        // ── Scrollable, date-grouped list ─────────────────────────────────
        if (sessions.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(AppColors.surfaceInput, RoundedCornerShape(24.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Outlined.ChatBubbleOutline,
                        contentDescription = null,
                        tint = AppColors.textDisabled,
                        modifier = Modifier.size(22.dp)
                    )
                }
                Spacer(modifier = Modifier.height(14.dp))
                Text(
                    "No conversations yet",
                    color = AppColors.textMuted,
                    fontSize = 14.sp
                )
            }
        } else if (groups.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    "No chats match your search",
                    color = AppColors.textMuted,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
            ) {
                groups.forEach { (label, list) ->
                    item(key = "header-$label") {
                        Text(
                            label.uppercase(Locale.getDefault()),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = AppColors.textMuted,
                            modifier = Modifier.padding(start = 10.dp, top = 12.dp, bottom = 6.dp)
                        )
                    }
                    items(list, key = { it.sessionId }) { session ->
                        HistoryRow(
                            session = session,
                            isActive = session.sessionId == currentSessionId,
                            onSelect = { onSelect(session) },
                            onRequestDelete = { pendingDelete = session }
                        )
                    }
                }
            }
        }
    }

    pendingDelete?.let { target ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            containerColor = AppColors.surfaceVar,
            titleContentColor = AppColors.textPrimary,
            textContentColor = AppColors.textMuted,
            title = { Text("Delete chat?", fontWeight = FontWeight.Bold) },
            text = {
                Text("“${sessionTitle(target)}” and all of its messages will be permanently deleted.")
            },
            confirmButton = {
                TextButton(onClick = {
                    onDelete(target.sessionId)
                    pendingDelete = null
                }) {
                    Text("Delete", color = AppColors.error, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) {
                    Text("Cancel", color = AppColors.textMuted)
                }
            }
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun HistoryRow(
    session: ChatSession,
    isActive: Boolean,
    onSelect: () -> Unit,
    onRequestDelete: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (isActive) AppColors.primary.copy(alpha = 0.12f) else Color.Transparent)
            .combinedClickable(onClick = onSelect, onLongClick = onRequestDelete)
            .padding(horizontal = 10.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .background(
                    if (isActive) AppColors.primary.copy(alpha = 0.18f) else AppColors.surfaceInput,
                    RoundedCornerShape(10.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                Icons.Outlined.ChatBubbleOutline,
                contentDescription = null,
                tint = if (isActive) AppColors.primary else AppColors.textMuted,
                modifier = Modifier.size(16.dp)
            )
        }
        Spacer(modifier = Modifier.width(11.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                sessionTitle(session),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (isActive) AppColors.primary else AppColors.textPrimary,
                maxLines = 1
            )
            val subtitle = sessionSubtitle(session)
            if (subtitle.isNotEmpty()) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    subtitle,
                    fontSize = 12.sp,
                    color = AppColors.textMuted,
                    maxLines = 1
                )
            }
        }
    }
}
