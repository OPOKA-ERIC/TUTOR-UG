package com.tutorug.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.tutorug.app.data.model.InsightType
import com.tutorug.app.data.model.StudyInsight
import com.tutorug.app.data.model.TimetableEntry
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.theme.*

private val DAY_NAMES = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
private val FULL_DAY_NAMES = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")

private val ENTRY_COLORS = listOf(
    "#FFC107", "#00E5FF", "#7C4DFF", "#00E676", "#FF6B6B",
    "#FF9800", "#E040FB", "#00BCD4", "#8BC34A", "#F06292"
)

@Composable
fun TimetableScreen(
    userProfile: UserProfile,
    entries: List<TimetableEntry>,
    isLoading: Boolean,
    errorMessage: String?,
    insights: List<StudyInsight> = emptyList(),
    onAddEntry: (TimetableEntry) -> Unit,
    onDeleteEntry: (String) -> Unit,
    onDismissError: () -> Unit,
    onBackClick: () -> Unit
) {
    var showAddDialog by remember { mutableStateOf(false) }
    var selectedDay by remember { mutableStateOf(0) } // index into DAY_NAMES

    val bg      = AppColors.background
    val surface = AppColors.surface
    val primary = AppColors.primary

    if (showAddDialog) {
        AddEntryDialog(
            userProfile  = userProfile,
            onDismiss    = { showAddDialog = false },
            onConfirm    = { entry -> onAddEntry(entry); showAddDialog = false }
        )
    }

    errorMessage?.let {
        LaunchedEffect(it) {
            kotlinx.coroutines.delay(3000)
            onDismissError()
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(surface, bg)))) {

        // Decorative glow
        Box(
            modifier = Modifier.size(220.dp).align(Alignment.TopEnd).offset(x = 60.dp, y = (-30).dp)
                .background(Brush.radialGradient(listOf(primary.copy(alpha = 0.08f), Color.Transparent)), CircleShape)
        )

        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {

            // ── TOP BAR ───────────────────────────────────────────────────────
            Box(
                modifier = Modifier.fillMaxWidth()
                    .background(Brush.horizontalGradient(listOf(AppColors.barStart, AppColors.barEnd)))
                    .padding(horizontal = 8.dp, vertical = 8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier.size(48.dp).noRippleClickable { onBackClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier.size(36.dp).background(AppColors.surfaceInput, CircleShape),
                            contentAlignment = Alignment.Center
                        ) { Icon(Icons.Default.ArrowBack, null, tint = AppColors.textPrimary, modifier = Modifier.size(18.dp)) }
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                    AppLogo()
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("Study Timetable", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = AppColors.textPrimary)
                        Text("Plan your week", fontSize = 11.sp, color = AppColors.textMuted)
                    }
                    Spacer(modifier = Modifier.weight(1f))
                    Box(
                        modifier = Modifier.size(40.dp)
                            .background(Amber500.copy(alpha = 0.15f), CircleShape)
                            .noRippleClickable { showAddDialog = true },
                        contentAlignment = Alignment.Center
                    ) { Icon(Icons.Default.Add, null, tint = Amber500, modifier = Modifier.size(22.dp)) }
                    Spacer(modifier = Modifier.width(8.dp))
                }
            }

            // ── DAY TABS ──────────────────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth()
                    .background(AppColors.surfaceCard)
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                DAY_NAMES.forEachIndexed { idx, day ->
                    val isSelected = idx == selectedDay
                    val dayEntries = entries.filter { it.dayOfWeek == idx + 1 }
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .background(
                                if (isSelected) Amber500 else AppColors.surfaceInput,
                                RoundedCornerShape(10.dp)
                            )
                            .noRippleClickable { selectedDay = idx }
                            .padding(vertical = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            day,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSelected) Color.Black else AppColors.textMuted
                        )
                        if (dayEntries.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(2.dp))
                            Box(
                                modifier = Modifier.size(5.dp)
                                    .background(if (isSelected) Color.Black.copy(alpha = 0.5f) else Amber500, CircleShape)
                            )
                        }
                    }
                }
            }

            // ── ENTRIES LIST ──────────────────────────────────────────────────
            val dayEntries = entries.filter { it.dayOfWeek == selectedDay + 1 }

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Amber500)
                }
            } else if (dayEntries.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.CalendarToday, null, tint = AppColors.textMuted, modifier = Modifier.size(56.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            "No sessions on ${FULL_DAY_NAMES[selectedDay]}",
                            fontSize = 16.sp, color = AppColors.textMuted, fontWeight = FontWeight.Medium
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("Tap + to add a study session", fontSize = 13.sp, color = AppColors.textDisabled)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().navigationBarsPadding(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(dayEntries, key = { it.entryId }) { entry ->
                        TimetableEntryCard(entry = entry, onDelete = { onDeleteEntry(entry.entryId) })
                        // Show insights for this entry (last 7 days, most recent first)
                        val entryInsights = insights
                            .filter { it.entryId == entry.entryId }
                            .take(3)
                        entryInsights.forEach { insight ->
                            Spacer(modifier = Modifier.height(6.dp))
                            InsightCard(insight = insight)
                        }
                    }
                }
            }
        }

        // Error snackbar
        errorMessage?.let {
            Box(
                modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp).navigationBarsPadding()
                    .background(Coral500, RoundedCornerShape(12.dp))
                    .padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                Text(it, color = Color.White, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun TimetableEntryCard(entry: TimetableEntry, onDelete: () -> Unit) {
    val accentColor = runCatching { Color(android.graphics.Color.parseColor(entry.colorHex)) }.getOrDefault(Amber500)
    var showDeleteConfirm by remember { mutableStateOf(false) }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            containerColor = AppColors.surfaceCard,
            shape = RoundedCornerShape(16.dp),
            title = { Text("Delete Session?", color = AppColors.textPrimary, fontWeight = FontWeight.Bold) },
            text  = { Text("Remove ${entry.subject} from your timetable?", color = AppColors.textMuted, fontSize = 14.sp) },
            confirmButton = {
                Button(
                    onClick = { showDeleteConfirm = false; onDelete() },
                    colors = ButtonDefaults.buttonColors(containerColor = Coral500),
                    shape = RoundedCornerShape(8.dp)
                ) { Text("Delete", fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel", color = AppColors.textMuted)
                }
            }
        )
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = AppColors.surfaceCard
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            // Color bar
            Box(
                modifier = Modifier.width(4.dp).height(56.dp)
                    .background(accentColor, RoundedCornerShape(2.dp))
            )
            Spacer(modifier = Modifier.width(14.dp))
            // Subject icon
            Box(
                modifier = Modifier.size(48.dp)
                    .background(accentColor.copy(alpha = 0.15f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.MenuBook, null, tint = accentColor, modifier = Modifier.size(24.dp))
            }
            Spacer(modifier = Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(entry.subject, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = AppColors.textPrimary)
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.AccessTime, null, tint = accentColor, modifier = Modifier.size(13.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        "%02d:%02d – %02d:%02d".format(entry.startHour, entry.startMin, entry.endHour, entry.endMin),
                        fontSize = 13.sp, color = accentColor, fontWeight = FontWeight.Medium
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Notifications, null, tint = AppColors.textMuted, modifier = Modifier.size(12.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Email reminder 15 min before • Alarm at start", fontSize = 11.sp, color = AppColors.textMuted)
                }
            }
            IconButton(onClick = { showDeleteConfirm = true }) {
                Icon(Icons.Default.DeleteOutline, null, tint = Coral500.copy(alpha = 0.7f), modifier = Modifier.size(20.dp))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddEntryDialog(
    userProfile: UserProfile,
    onDismiss: () -> Unit,
    onConfirm: (TimetableEntry) -> Unit
) {
    var subject      by remember { mutableStateOf("") }
    var selectedDay  by remember { mutableStateOf(0) }
    var startHour    by remember { mutableStateOf(8) }
    var startMin     by remember { mutableStateOf(0) }
    var endHour      by remember { mutableStateOf(9) }
    var endMin       by remember { mutableStateOf(0) }
    var selectedColor by remember { mutableStateOf(ENTRY_COLORS[0]) }
    var subjectError by remember { mutableStateOf(false) }
    var timeError    by remember { mutableStateOf(false) }

    val isTypedInput = remember(userProfile) {
        userProfile.educationLevel == "University" || userProfile.educationLevel == "Professional"
    }
    val subjects = remember(userProfile) {
        if (isTypedInput) emptyList()
        else com.tutorug.app.util.Constants.getSidebarItems(userProfile)
            .ifEmpty { com.tutorug.app.util.Constants.O_LEVEL_SUBJECTS }
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = AppColors.surfaceCard,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(20.dp)) {

                // Header
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier.size(40.dp).background(Amber500.copy(alpha = 0.15f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) { Icon(Icons.Default.Add, null, tint = Amber500, modifier = Modifier.size(20.dp)) }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text("Add Study Session", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = AppColors.textPrimary)
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Subject — free-text for University/Professional, dropdown for others
                val levelLabel = when (userProfile.educationLevel) {
                    "University"   -> "e.g. Calculus, Data Structures, Research…"
                    "Professional" -> "e.g. Project Management, Excel, Accounting…"
                    else           -> "Select subject…"
                }
                Text("Subject", fontSize = 12.sp, color = AppColors.textMuted, fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(6.dp))

                if (isTypedInput) {
                    // ── Free-text field for University / Professional ──────────
                    OutlinedTextField(
                        value = subject,
                        onValueChange = { subject = it; subjectError = false },
                        placeholder = { Text(levelLabel, fontSize = 13.sp, color = AppColors.textDisabled) },
                        isError = subjectError,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor   = Amber500,
                            unfocusedBorderColor = AppColors.outline,
                            errorBorderColor     = Coral500,
                            focusedTextColor     = AppColors.textPrimary,
                            unfocusedTextColor   = AppColors.textPrimary,
                            cursorColor          = Amber500,
                            focusedContainerColor   = AppColors.surfaceInput,
                            unfocusedContainerColor = AppColors.surfaceInput
                        )
                    )
                } else {
                    // ── Dropdown for Primary / O-Level / A-Level ─────────────
                    var subjectExpanded by remember { mutableStateOf(false) }
                    Box {
                        Row(
                            modifier = Modifier.fillMaxWidth()
                                .border(
                                    1.dp,
                                    if (subjectError) Coral500 else AppColors.outline,
                                    RoundedCornerShape(10.dp)
                                )
                                .background(AppColors.surfaceInput, RoundedCornerShape(10.dp))
                                .noRippleClickable { subjectExpanded = true }
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                subject.ifBlank { levelLabel },
                                modifier = Modifier.weight(1f),
                                color = if (subject.isBlank()) AppColors.textDisabled else AppColors.textPrimary,
                                fontSize = 14.sp
                            )
                            Icon(Icons.Default.ArrowDropDown, null, tint = AppColors.textMuted)
                        }
                        DropdownMenu(
                            expanded = subjectExpanded,
                            onDismissRequest = { subjectExpanded = false },
                            modifier = Modifier.background(AppColors.surfaceCard).heightIn(max = 220.dp)
                        ) {
                            subjects.forEach { s ->
                                DropdownMenuItem(
                                    text = {
                                        Text(
                                            s,
                                            color = if (s == subject) Amber500 else AppColors.textPrimary,
                                            fontSize = 14.sp
                                        )
                                    },
                                    onClick = { subject = s; subjectExpanded = false; subjectError = false }
                                )
                            }
                        }
                    }
                }
                if (subjectError) Text(
                    if (isTypedInput) "Please type what you will study" else "Please select a subject",
                    fontSize = 11.sp, color = Coral500
                )

                Spacer(modifier = Modifier.height(14.dp))

                // Day picker
                Text("Day", fontSize = 12.sp, color = AppColors.textMuted, fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    DAY_NAMES.forEachIndexed { idx, day ->
                        val sel = idx == selectedDay
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .background(if (sel) Amber500 else AppColors.surfaceInput, RoundedCornerShape(8.dp))
                                .noRippleClickable { selectedDay = idx }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(day, fontSize = 10.sp, color = if (sel) Color.Black else AppColors.textMuted,
                                fontWeight = if (sel) FontWeight.Bold else FontWeight.Normal)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Time pickers
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Start Time", fontSize = 12.sp, color = AppColors.textMuted, fontWeight = FontWeight.Medium)
                        Spacer(modifier = Modifier.height(6.dp))
                        TimePickerRow(
                            hour = startHour, min = startMin,
                            onHourChange = { startHour = it; timeError = false },
                            onMinChange  = { startMin = it; timeError = false }
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("End Time", fontSize = 12.sp, color = AppColors.textMuted, fontWeight = FontWeight.Medium)
                        Spacer(modifier = Modifier.height(6.dp))
                        TimePickerRow(
                            hour = endHour, min = endMin,
                            onHourChange = { endHour = it; timeError = false },
                            onMinChange  = { endMin = it; timeError = false }
                        )
                    }
                }
                if (timeError) Text("End time must be after start time", fontSize = 11.sp, color = Coral500)

                Spacer(modifier = Modifier.height(14.dp))

                // Color picker
                Text("Colour", fontSize = 12.sp, color = AppColors.textMuted, fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ENTRY_COLORS.forEach { hex ->
                        val c = runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(Amber500)
                        Box(
                            modifier = Modifier.size(28.dp)
                                .background(c, CircleShape)
                                .then(
                                    if (hex == selectedColor)
                                        Modifier.border(2.dp, Color.White, CircleShape)
                                    else Modifier
                                )
                                .noRippleClickable { selectedColor = hex }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Info note
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .background(Amber500.copy(alpha = 0.08f), RoundedCornerShape(10.dp))
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Info, null, tint = Amber500, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "You'll get an email 15 min before & an alarm when it's time to study.",
                        fontSize = 11.sp, color = AppColors.textMuted
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Buttons
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    ) { Text("Cancel", color = AppColors.textMuted) }

                    Button(
                        onClick = {
                            subjectError = subject.isBlank()
                            val startTotal = startHour * 60 + startMin
                            val endTotal   = endHour * 60 + endMin
                            timeError = endTotal <= startTotal
                            if (!subjectError && !timeError) {
                                onConfirm(
                                    TimetableEntry(
                                        userId     = userProfile.userId,
                                        subject    = subject,
                                        dayOfWeek  = selectedDay + 1,
                                        startHour  = startHour,
                                        startMin   = startMin,
                                        endHour    = endHour,
                                        endMin     = endMin,
                                        colorHex   = selectedColor
                                    )
                                )
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Amber500),
                        shape = RoundedCornerShape(10.dp)
                    ) { Text("Save", color = Color.Black, fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}

@Composable
private fun InsightCard(insight: StudyInsight) {
    val (bgColor, borderColor, icon) = when (insight.type) {
        InsightType.GOOD            -> Triple(Lime500.copy(alpha = 0.08f),  Lime500.copy(alpha = 0.4f),  "✅")
        InsightType.NEEDS_MORE_TIME -> Triple(Amber500.copy(alpha = 0.08f), Amber500.copy(alpha = 0.4f), "⏰")
        InsightType.MISSED          -> Triple(Coral500.copy(alpha = 0.08f),  Coral500.copy(alpha = 0.4f),  "❌")
        InsightType.NO_DATA         -> Triple(AppColors.surfaceInput,         AppColors.outline,            "📊")
        InsightType.STUDY_TIME_ADVICE -> Triple(AppColors.surfaceInput,       AppColors.outline,            "💡")
    }
    val accentColor = when (insight.type) {
        InsightType.GOOD              -> Lime500
        InsightType.NEEDS_MORE_TIME   -> Amber500
        InsightType.MISSED            -> Coral500
        InsightType.NO_DATA           -> AppColors.textMuted
        InsightType.STUDY_TIME_ADVICE -> AppColors.textMuted
    }
    // Format date nicely e.g. "Mon 12 Jan"
    val displayDate = try {
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
        val out = java.text.SimpleDateFormat("EEE d MMM", java.util.Locale.getDefault())
        out.format(sdf.parse(insight.dateStr)!!)
    } catch (_: Exception) { insight.dateStr }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = bgColor
    ) {
        Row(
            modifier = Modifier
                .border(1.dp, borderColor, RoundedCornerShape(12.dp))
                .padding(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            Text(icon, fontSize = 18.sp, modifier = Modifier.padding(top = 1.dp))
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        displayDate,
                        fontSize = 11.sp,
                        color = accentColor,
                        fontWeight = FontWeight.Bold
                    )
                    if (insight.avgScore > 0) {
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = accentColor.copy(alpha = 0.15f)
                        ) {
                            Text(
                                "Quiz: ${insight.avgScore}%",
                                fontSize = 10.sp,
                                color = accentColor,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                            )
                        }
                    }
                    if (insight.scheduledMins > 0) {
                        Text(
                            "${insight.attendedMins}/${insight.scheduledMins} min",
                            fontSize = 10.sp,
                            color = AppColors.textMuted
                        )
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    insight.recommendation,
                    fontSize = 12.sp,
                    color = AppColors.textMuted,
                    lineHeight = 17.sp
                )
            }
        }
    }
}

@Composable
private fun TimePickerRow(
    hour: Int, min: Int,
    onHourChange: (Int) -> Unit,
    onMinChange: (Int) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.surfaceInput, RoundedCornerShape(10.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        // Hour
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.KeyboardArrowUp, null, tint = Amber500, modifier = Modifier.size(20.dp)
                .noRippleClickable { onHourChange((hour + 1) % 24) })
            Text("%02d".format(hour), fontSize = 18.sp, fontWeight = FontWeight.Bold, color = AppColors.textPrimary)
            Icon(Icons.Default.KeyboardArrowDown, null, tint = Amber500, modifier = Modifier.size(20.dp)
                .noRippleClickable { onHourChange((hour + 23) % 24) })
        }
        Text(":", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = AppColors.textPrimary,
            modifier = Modifier.padding(horizontal = 4.dp))
        // Minute
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.KeyboardArrowUp, null, tint = Amber500, modifier = Modifier.size(20.dp)
                .noRippleClickable { onMinChange((min + 5) % 60) })
            Text("%02d".format(min), fontSize = 18.sp, fontWeight = FontWeight.Bold, color = AppColors.textPrimary)
            Icon(Icons.Default.KeyboardArrowDown, null, tint = Amber500, modifier = Modifier.size(20.dp)
                .noRippleClickable { onMinChange((min + 55) % 60) })
        }
    }
}
