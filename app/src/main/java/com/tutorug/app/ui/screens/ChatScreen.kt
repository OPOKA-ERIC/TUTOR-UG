package com.tutorug.app.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.tutorug.app.data.model.ChatMessage
import com.tutorug.app.data.model.ChatSession
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.theme.*
import com.tutorug.app.util.Constants

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    userProfile: UserProfile = UserProfile(),
    messages: List<ChatMessage> = emptyList(),
    chatHistory: List<ChatSession> = emptyList(),
    currentSubject: String = "",
    isLoading: Boolean = false,
    isStreaming: Boolean = false,
    streamingText: String = "",
    errorMessage: String? = null,
    onSendMessage: (String) -> Unit = {},
    onVoiceInput: () -> Unit = {},
    onFileSelected: (android.net.Uri, String, String) -> Unit = { _, _, _ -> },
    onSubjectSelect: (String) -> Unit = {},
    onSessionSelect: (String) -> Unit = {},
    onNewChat: () -> Unit = {},
    onSettingsClick: () -> Unit = {},
    onTimetableClick: () -> Unit = {},
    onLogout: () -> Unit = {},
    onDeleteSession: (String) -> Unit = {},
    onEditMessage: (index: Int, newText: String) -> Unit = { _, _ -> }
) {
    var messageText by remember { mutableStateOf("") }
    var editingIndex by remember { mutableStateOf(-1) }
    var pendingFileUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var pendingFileName by remember { mutableStateOf("") }
    var drawerOpen by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val context = androidx.compose.ui.platform.LocalContext.current

    val fileLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            val fileName = context.contentResolver.query(it, null, null, null, null)?.use { cursor ->
                val idx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                cursor.moveToFirst()
                if (idx >= 0) cursor.getString(idx) else null
            } ?: "document_${System.currentTimeMillis()}"
            pendingFileUri = it
            pendingFileName = fileName
        }
    }

    val isUniversityOrProfessional = userProfile.educationLevel == "University" ||
            userProfile.educationLevel == "Professional"
    val sidebarSubjects = Constants.getSidebarItems(userProfile)
    val showChatHistory = isUniversityOrProfessional

    val contextLabel = when {
        userProfile.educationLevel == "University"   -> userProfile.course.ifBlank { "University" }
        userProfile.educationLevel == "Professional" -> userProfile.profession.ifBlank { "Professional" }
        userProfile.educationLevel in listOf("S5", "S6") ->
            "${userProfile.educationLevel} • ${userProfile.combination.ifBlank { "A-Level" }}"
        else -> userProfile.educationLevel
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    val bg           = AppColors.background
    val surface      = AppColors.surface
    val surfaceVar   = AppColors.surfaceVar
    val primary      = AppColors.primary
    val onPrimary    = AppColors.onPrimary
    val secondary    = AppColors.secondary
    val tertiary     = AppColors.tertiary
    val outline      = AppColors.outline
    val surfaceInput = AppColors.surfaceInput
    val onSurfaceVar = AppColors.onSurfaceVar
    val barStart     = AppColors.barStart
    val barEnd       = AppColors.barEnd
    val error        = AppColors.error

    Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(surface, bg)))) {
        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {

            // ── TOP BAR ──────────────────────────────────────────────
            Box(
                modifier = Modifier.fillMaxWidth()
                    .background(Brush.horizontalGradient(listOf(barStart, barEnd)))
                    .padding(horizontal = 4.dp, vertical = 8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .noRippleClickable { drawerOpen = true },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Menu, contentDescription = "Menu", tint = AppColors.textPrimary)
                    }
                    Box(
                        modifier = Modifier.size(38.dp)
                            .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape)
                            .clip(CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        if (userProfile.avatarUrl.isNotBlank()) {
                            AsyncImage(
                                model = userProfile.avatarUrl,
                                contentDescription = "Profile picture",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            Text(userProfile.name.firstOrNull()?.uppercase() ?: "U",
                                fontSize = 16.sp, fontWeight = FontWeight.Bold, color = onPrimary)
                        }
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(userProfile.name.ifBlank { "Student" }, fontSize = 15.sp,
                            fontWeight = FontWeight.Bold, color = AppColors.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(
                            buildString {
                                append(contextLabel)
                                if (userProfile.district.isNotBlank()) append(" • ${userProfile.district}")
                            },
                            fontSize = 11.sp, color = onSurfaceVar, maxLines = 1, overflow = TextOverflow.Ellipsis
                        )
                    }
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .noRippleClickable { onTimetableClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.CalendarMonth, contentDescription = "Timetable", tint = onSurfaceVar)
                    }
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .noRippleClickable { onSettingsClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings", tint = onSurfaceVar)
                    }
                }
            }

            // ── MESSAGES ─────────────────────────────────────────────
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp),
                state = listState
            ) {
                if (messages.isEmpty()) {
                    item {
                        Column(modifier = Modifier.fillMaxWidth().padding(top = 48.dp),
                            horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("👋", fontSize = 56.sp)
                            Spacer(modifier = Modifier.height(12.dp))
                            Text("Hello ${userProfile.name.ifBlank { "there" }}!",
                                fontSize = 22.sp, fontWeight = FontWeight.Bold, color = primary)
                            Spacer(modifier = Modifier.height(8.dp))
                            when {
                                userProfile.educationLevel == "University" -> {
                                    Text("Course: ${userProfile.course.ifBlank { "Not set" }}", fontSize = 13.sp, color = onSurfaceVar)
                                    if (userProfile.school.isNotBlank())
                                        Text("University: ${userProfile.school}", fontSize = 13.sp, color = onSurfaceVar)
                                }
                                userProfile.educationLevel == "Professional" ->
                                    Text("Profession: ${userProfile.profession.ifBlank { "Not set" }}", fontSize = 13.sp, color = onSurfaceVar)
                                userProfile.educationLevel in listOf("S5", "S6") -> {
                                    Text("Combination: ${userProfile.combination.ifBlank { "Not set" }}", fontSize = 13.sp, color = onSurfaceVar)
                                    if (userProfile.school.isNotBlank())
                                        Text("School: ${userProfile.school}", fontSize = 13.sp, color = onSurfaceVar)
                                }
                                else -> Text(
                                    "Level: ${userProfile.educationLevel}${if (userProfile.school.isNotBlank()) " • ${userProfile.school}" else ""}",
                                    fontSize = 13.sp, color = onSurfaceVar)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("District: ${userProfile.district.ifBlank { "Not set" }}", fontSize = 13.sp, color = onSurfaceVar)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                "What's on your mind today?",
                                fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = primary
                            )
                        }
                    }
                }

                items(messages) { message ->
                    val index = messages.indexOf(message)
                    ChatBubble(
                        message = message,
                        primary = primary,
                        onPrimary = onPrimary,
                        surface = surface,
                        surfaceVar = surfaceVar,
                        onEditClick = if (message.role == "user") {{
                            messageText = message.content
                            editingIndex = index
                        }} else null
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                }

                if (isLoading) {
                    item {
                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.Start) {
                            // AI avatar
                            Box(
                                modifier = Modifier.size(32.dp)
                                    .background(Brush.linearGradient(listOf(Amber400, Violet600)), CircleShape),
                                contentAlignment = Alignment.Center
                            ) { Text("AI", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White) }
                            Spacer(modifier = Modifier.width(8.dp))
                            Surface(shape = RoundedCornerShape(4.dp, 18.dp, 18.dp, 18.dp), color = surface,
                                modifier = Modifier.padding(end = 48.dp)) {
                                Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                    repeat(3) { i ->
                                        val infiniteTransition = rememberInfiniteTransition(label = "dot$i")
                                        val dotAlpha by infiniteTransition.animateFloat(
                                            initialValue = 0.2f, targetValue = 1f,
                                            animationSpec = infiniteRepeatable(tween(500, delayMillis = i * 150), RepeatMode.Reverse),
                                            label = "dot$i"
                                        )
                                        Box(modifier = Modifier.size(7.dp).alpha(dotAlpha)
                                            .background(primary, CircleShape))
                                        if (i < 2) Spacer(modifier = Modifier.width(4.dp))
                                    }
                                }
                            }
                        }
                    }
                }

                // Streaming bubble — shows AI response token by token
                if (isStreaming && streamingText.isNotBlank()) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.Start,
                            verticalAlignment = Alignment.Bottom
                        ) {
                            Box(
                                modifier = Modifier.size(32.dp)
                                    .background(Brush.linearGradient(listOf(Amber400, Violet600)), CircleShape),
                                contentAlignment = Alignment.Center
                            ) { Text("AI", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White) }
                            Spacer(modifier = Modifier.width(8.dp))
                            Column(modifier = Modifier.widthIn(max = 300.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(bottom = 4.dp, start = 2.dp)) {
                                    Text("TutorUG AI", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = primary)
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Surface(shape = RoundedCornerShape(4.dp), color = primary.copy(alpha = 0.15f)) {
                                        Text("✦", fontSize = 9.sp, color = primary,
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp))
                                    }
                                }
                                SelectionContainer {
                                    Box(
                                        modifier = Modifier
                                            .border(1.dp,
                                                Brush.linearGradient(listOf(primary.copy(alpha = 0.5f), Violet400.copy(alpha = 0.3f))),
                                                RoundedCornerShape(4.dp, 18.dp, 18.dp, 18.dp))
                                            .background(Brush.linearGradient(listOf(surface, surfaceVar)),
                                                RoundedCornerShape(4.dp, 18.dp, 18.dp, 18.dp))
                                            .padding(horizontal = 14.dp, vertical = 12.dp)
                                    ) {
                                        val infiniteTransition = rememberInfiniteTransition(label = "cursor")
                                        val cursorAlpha by infiniteTransition.animateFloat(
                                            initialValue = 0f, targetValue = 1f,
                                            animationSpec = infiniteRepeatable(tween(500), RepeatMode.Reverse),
                                            label = "cursor"
                                        )
                                        FormattedAIText(streamingText + "█".repeat(1).let {
                                            if (cursorAlpha > 0.5f) "█" else " "
                                        }, primary)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ── ERROR BAR ─────────────────────────────────────────────
            if (errorMessage != null) {
                Surface(modifier = Modifier.fillMaxWidth(), color = error.copy(alpha = 0.9f)) {
                    Text(errorMessage, color = Color.White, fontSize = 13.sp,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
                }
            }

            // ── INPUT BAR ────────────────────────────────────────────
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .imePadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Column {
                    if (editingIndex >= 0) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 4.dp)
                                .background(primary.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Edit, null, tint = primary, modifier = Modifier.size(13.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Editing message", fontSize = 11.sp, color = primary, modifier = Modifier.weight(1f))
                            Box(
                                modifier = Modifier
                                    .size(18.dp)
                                    .noRippleClickable { editingIndex = -1; messageText = "" },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Close, null, tint = AppColors.textMuted, modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                    // ── File preview chip ─────────────────────────────
                    if (pendingFileUri != null) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 4.dp)
                                .background(primary.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.AttachFile, null, tint = primary, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                pendingFileName,
                                fontSize = 11.sp,
                                color = primary,
                                modifier = Modifier.weight(1f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Box(
                                modifier = Modifier
                                    .size(18.dp)
                                    .noRippleClickable { pendingFileUri = null; pendingFileName = "" },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Close, null, tint = AppColors.textMuted, modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.linearGradient(listOf(surfaceVar, surface)),
                            RoundedCornerShape(32.dp)
                        )
                        .border(
                            width = 1.5.dp,
                            brush = Brush.linearGradient(listOf(primary.copy(alpha = 0.7f), tertiary.copy(alpha = 0.5f))),
                            shape = RoundedCornerShape(32.dp)
                        )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = onVoiceInput,
                            modifier = Modifier
                                .size(40.dp)
                                .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape)
                        ) { Icon(Icons.Default.Mic, contentDescription = "Voice", tint = onPrimary, modifier = Modifier.size(20.dp)) }
                        Spacer(modifier = Modifier.width(8.dp))
                        IconButton(
                            onClick = { fileLauncher.launch("*/*") },
                            modifier = Modifier
                                .size(40.dp)
                                .background(primary.copy(alpha = 0.12f), CircleShape)
                        ) { Icon(Icons.Default.AttachFile, contentDescription = "Upload", tint = primary, modifier = Modifier.size(20.dp)) }
                        Spacer(modifier = Modifier.width(10.dp))
                        BasicTextField(
                            value = messageText,
                            onValueChange = { messageText = it },
                            modifier = Modifier.weight(1f),
                            textStyle = TextStyle(color = AppColors.textPrimary, fontSize = 14.sp),
                            cursorBrush = Brush.linearGradient(listOf(primary, tertiary)),
                            maxLines = 4,
                            decorationBox = { inner ->
                                if (messageText.isEmpty()) {
                                    Text("Ask a question...", color = AppColors.textDisabled, fontSize = 14.sp)
                                }
                                inner()
                            }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        val canSend = (messageText.isNotBlank() || pendingFileUri != null) && !isLoading
                        IconButton(
                            onClick = {
                                if (canSend) {
                                    when {
                                        pendingFileUri != null -> {
                                            onFileSelected(pendingFileUri!!, pendingFileName, messageText.trim())
                                            pendingFileUri = null
                                            pendingFileName = ""
                                            messageText = ""
                                        }
                                        editingIndex >= 0 -> {
                                            onEditMessage(editingIndex, messageText)
                                            editingIndex = -1
                                            messageText = ""
                                        }
                                        else -> {
                                            onSendMessage(messageText)
                                            messageText = ""
                                        }
                                    }
                                }
                            },
                            modifier = Modifier
                                .size(40.dp)
                                .background(
                                    if (canSend) Brush.linearGradient(listOf(tertiary, Violet600))
                                    else Brush.linearGradient(listOf(surfaceVar, surfaceVar)),
                                    CircleShape
                                ),
                            enabled = canSend
                        ) { Icon(Icons.Default.Send, contentDescription = "Send", tint = AppColors.textPrimary, modifier = Modifier.size(20.dp)) }
                    }
                }
                } // end Column (editing banner + input box)
            } // end outer Box (input bar padding)
        }

        // ── DRAWER ───────────────────────────────────────────────────
        if (drawerOpen) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.65f)).clickable { drawerOpen = false })
            Surface(
                modifier = Modifier.fillMaxHeight().width(290.dp).statusBarsPadding().navigationBarsPadding(),
                color = surface
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    // Profile card
                    Box(modifier = Modifier.fillMaxWidth()
                        .background(Brush.linearGradient(listOf(barStart, barEnd))).padding(16.dp)) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier.size(52.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (userProfile.avatarUrl.isNotBlank()) {
                                        AsyncImage(
                                            model = userProfile.avatarUrl,
                                            contentDescription = "Profile picture",
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxSize().clip(CircleShape)
                                        )
                                    } else {
                                        Box(
                                            modifier = Modifier.fillMaxSize()
                                                .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(userProfile.name.firstOrNull()?.uppercase() ?: "U",
                                                fontSize = 22.sp, fontWeight = FontWeight.Bold, color = onPrimary)
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(userProfile.name.ifBlank { "Student" }, fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold, color = AppColors.textPrimary)
                                    Text(userProfile.email, fontSize = 11.sp, color = onSurfaceVar,
                                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            HorizontalDivider(color = AppColors.divider)
                            Spacer(modifier = Modifier.height(10.dp))
                            when {
                                userProfile.educationLevel == "University" -> {
                                    DrawerProfileRow("Course", userProfile.course.ifBlank { "—" }, onSurfaceVar)
                                    if (userProfile.school.isNotBlank()) DrawerProfileRow("University", userProfile.school, onSurfaceVar)
                                }
                                userProfile.educationLevel == "Professional" ->
                                    DrawerProfileRow("Profession", userProfile.profession.ifBlank { "—" }, onSurfaceVar)
                                userProfile.educationLevel in listOf("S5", "S6") -> {
                                    DrawerProfileRow("Combination", userProfile.combination.ifBlank { "—" }, onSurfaceVar)
                                    if (userProfile.school.isNotBlank()) DrawerProfileRow("School", userProfile.school, onSurfaceVar)
                                }
                                else -> if (userProfile.school.isNotBlank()) DrawerProfileRow("School", userProfile.school, onSurfaceVar)
                            }
                        }
                    }

                    Column(modifier = Modifier.weight(1f).padding(horizontal = 16.dp, vertical = 12.dp)) {
                        Button(
                            onClick = { onNewChat(); drawerOpen = false },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Box(
                                modifier = Modifier.fillMaxWidth().height(44.dp)
                                    .background(Brush.linearGradient(listOf(Amber400, Amber600)), RoundedCornerShape(12.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Add, null, tint = onPrimary, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("New Chat", fontWeight = FontWeight.Bold, color = onPrimary)
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))

                        val isOLevel = userProfile.educationLevel in listOf("S1", "S2", "S3", "S4")

                        // ── SUBJECTS (all levels except University/Professional) ──
                        if (!showChatHistory) {
                            Text("SUBJECTS", fontSize = 11.sp, color = onSurfaceVar, fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 6.dp))

                            if (isOLevel) {
                                // O-Level: compact fixed height scrollable box
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .heightIn(max = 180.dp)
                                        .background(surfaceVar, RoundedCornerShape(10.dp))
                                ) {
                                    Column(modifier = Modifier.verticalScroll(rememberScrollState()).padding(4.dp)) {
                                        sidebarSubjects.forEach { subject ->
                                            val isActive = subject == currentSubject
                                            Surface(
                                                modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)
                                                    .clickable { onSubjectSelect(subject); drawerOpen = false },
                                                color = if (isActive) primary.copy(alpha = 0.15f) else Color.Transparent,
                                                shape = RoundedCornerShape(8.dp)
                                            ) {
                                                Text(subject,
                                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                                                    color = if (isActive) primary else AppColors.textMuted,
                                                    fontSize = 12.sp,
                                                    fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Normal)
                                            }
                                        }
                                    }
                                }
                            } else {
                                // P1-P7 and S5-S6: normal scroll
                                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                                    sidebarSubjects.forEach { subject ->
                                        val isActive = subject == currentSubject
                                        Surface(
                                            modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)
                                                .clickable { onSubjectSelect(subject); drawerOpen = false },
                                            color = if (isActive) primary.copy(alpha = 0.12f) else surfaceVar,
                                            shape = RoundedCornerShape(10.dp)
                                        ) {
                                            Text(subject, modifier = Modifier.padding(12.dp),
                                                color = if (isActive) primary else AppColors.textMuted,
                                                fontSize = 13.sp,
                                                fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Normal)
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))
                        }

                        // ── CHAT HISTORY (all levels) ─────────────────────────
                        Text("CHAT HISTORY", fontSize = 11.sp, color = onSurfaceVar, fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 6.dp))

                        if (chatHistory.isEmpty()) {
                            Text(
                                if (showChatHistory) "No previous chats yet.\nStart a new chat above."
                                else "No chat history yet.",
                                fontSize = 12.sp, color = onSurfaceVar,
                                modifier = Modifier.padding(vertical = 6.dp)
                            )
                        } else {
                            // All levels: history in a scrollable box
                            val historyMaxHeight = if (isOLevel) 160.dp else 200.dp
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = historyMaxHeight)
                                    .verticalScroll(rememberScrollState())
                            ) {
                                chatHistory.forEach { session ->
                                    val title = session.subject.ifBlank {
                                        when {
                                            userProfile.educationLevel == "University" -> userProfile.course.ifBlank { "Chat" }
                                            userProfile.educationLevel == "Professional" -> userProfile.profession.ifBlank { "Chat" }
                                            else -> "Chat"
                                        }
                                    }
                                    var showDeleteConfirm by remember { mutableStateOf(false) }

                                    if (showDeleteConfirm) {
                                        AlertDialog(
                                            onDismissRequest = { showDeleteConfirm = false },
                                            containerColor = surfaceVar,
                                            shape = RoundedCornerShape(16.dp),
                                            title = { Text("Delete Chat?", color = AppColors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
                                            text = { Text("This will permanently delete this chat and all its messages.", color = onSurfaceVar, fontSize = 13.sp) },
                                            confirmButton = {
                                                Button(
                                                    onClick = {
                                                        onDeleteSession(session.sessionId)
                                                        showDeleteConfirm = false
                                                        drawerOpen = false
                                                    },
                                                    colors = ButtonDefaults.buttonColors(containerColor = error),
                                                    shape = RoundedCornerShape(8.dp)
                                                ) { Text("Delete", fontWeight = FontWeight.Bold) }
                                            },
                                            dismissButton = {
                                                TextButton(onClick = { showDeleteConfirm = false }) {
                                                    Text("Cancel", color = onSurfaceVar)
                                                }
                                            }
                                        )
                                    }

                                    Surface(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)
                                            .clickable { onSessionSelect(session.sessionId); drawerOpen = false },
                                        color = surfaceVar, shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(8.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(title, fontSize = 12.sp, color = primary,
                                                    fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                                session.messages.lastOrNull()?.let {
                                                    Text(it.content, fontSize = 10.sp, color = onSurfaceVar,
                                                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                                                }
                                            }
                                            if (session.messageCount > 0) {
                                                Surface(shape = RoundedCornerShape(20.dp), color = primary.copy(alpha = 0.15f)) {
                                                    Text("${session.messageCount}", fontSize = 9.sp, color = primary,
                                                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp))
                                                }
                                                Spacer(modifier = Modifier.width(2.dp))
                                            }
                                            IconButton(
                                                onClick = { showDeleteConfirm = true },
                                                modifier = Modifier.size(28.dp)
                                            ) {
                                                Icon(Icons.Default.Delete, null,
                                                    tint = error.copy(alpha = 0.7f),
                                                    modifier = Modifier.size(14.dp))
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                        HorizontalDivider(color = AppColors.divider)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(modifier = Modifier.fillMaxWidth()
                            .clickable { onSettingsClick(); drawerOpen = false }.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Settings, null, tint = onSurfaceVar)
                            Spacer(modifier = Modifier.width(12.dp))
                            Text("Settings", color = AppColors.textMuted, fontSize = 14.sp)
                        }
                        Row(modifier = Modifier.fillMaxWidth()
                            .clickable { onTimetableClick(); drawerOpen = false }.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CalendarMonth, null, tint = Amber500)
                            Spacer(modifier = Modifier.width(12.dp))
                            Text("Study Timetable", color = AppColors.textMuted, fontSize = 14.sp)
                        }
                        Row(modifier = Modifier.fillMaxWidth().clickable { onLogout() }.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.ExitToApp, null, tint = error)
                            Spacer(modifier = Modifier.width(12.dp))
                            Text("Logout", color = error, fontSize = 14.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DrawerProfileRow(label: String, value: String, mutedColor: Color) {
    Row(modifier = Modifier.padding(vertical = 2.dp)) {
        Text("$label: ", fontSize = 11.sp, color = mutedColor, fontWeight = FontWeight.Medium)
        Text(value, fontSize = 11.sp, color = AppColors.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun ChatBubble(
    message: ChatMessage,
    primary: Color = Amber500,
    onPrimary: Color = Ink900,
    surface: Color = SurfaceCard,
    surfaceVar: Color = SurfaceCard,
    onEditClick: (() -> Unit)? = null
) {
    val isUser = message.role == "user"

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
        verticalAlignment = if (isUser) Alignment.Top else Alignment.Bottom
    ) {
        if (!isUser) {
            // AI avatar
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .background(Brush.linearGradient(listOf(Amber400, Violet600)), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text("AI", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
            Spacer(modifier = Modifier.width(8.dp))
        }

        if (isUser) {
            // User bubble
            Box(
                modifier = Modifier
                    .widthIn(max = 280.dp)
                    .background(
                        Brush.linearGradient(listOf(Amber500.copy(alpha = 0.9f), Amber600)),
                        RoundedCornerShape(18.dp, 4.dp, 18.dp, 18.dp)
                    )
                    .padding(horizontal = 14.dp, vertical = 10.dp)
            ) {
                Text(message.content, fontSize = 14.sp, color = Color(0xFF1A1A1A), lineHeight = 20.sp)
            }
            if (onEditClick != null) {
                Box(
                    modifier = Modifier
                        .padding(horizontal = 4.dp)
                        .size(26.dp)
                        .background(AppColors.surfaceInput, RoundedCornerShape(6.dp))
                        .noRippleClickable { onEditClick() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Edit,
                        contentDescription = "Edit message",
                        tint = AppColors.textMuted,
                        modifier = Modifier.size(14.dp)
                    )
                }
            }
        } else {
            // AI bubble
            val clipboardManager = LocalClipboardManager.current
            var copied by remember { mutableStateOf(false) }
            if (copied) {
                LaunchedEffect(Unit) {
                    kotlinx.coroutines.delay(2000)
                    copied = false
                }
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 48.dp)
            ) {
                // Header label
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(bottom = 4.dp, start = 2.dp)
                ) {
                    Text(
                        "TutorUG AI",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = primary
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = primary.copy(alpha = 0.15f)
                    ) {
                        Text(
                            "✦",
                            fontSize = 9.sp,
                            color = primary,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                        )
                    }
                }
                // Bubble with gradient border
                SelectionContainer {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(
                                width = 1.dp,
                                brush = Brush.linearGradient(listOf(primary.copy(alpha = 0.5f), Violet400.copy(alpha = 0.3f))),
                                shape = RoundedCornerShape(4.dp, 18.dp, 18.dp, 18.dp)
                            )
                            .background(
                                Brush.linearGradient(listOf(surface, surfaceVar)),
                                RoundedCornerShape(4.dp, 18.dp, 18.dp, 18.dp)
                            )
                            .padding(horizontal = 14.dp, vertical = 12.dp)
                    ) {
                        FormattedAIText(message.content, primary)
                    }
                }
                // Copy icon below the bubble
                Row(
                    modifier = Modifier.padding(top = 4.dp, start = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .background(
                                if (copied) primary.copy(alpha = 0.15f) else Color.Transparent,
                                RoundedCornerShape(6.dp)
                            )
                            .noRippleClickable {
                                clipboardManager.setText(AnnotatedString(message.content))
                                copied = true
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            if (copied) Icons.Default.Check else Icons.Default.ContentCopy,
                            contentDescription = "Copy",
                            tint = if (copied) primary else AppColors.textMuted,
                            modifier = Modifier.size(15.dp)
                        )
                    }
                    if (copied) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Copied!", fontSize = 10.sp, color = primary)
                    }
                }
            }
        }

        if (isUser) {
            Spacer(modifier = Modifier.width(8.dp))
            // User avatar initial
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text("Me", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color(0xFF1A1A1A))
            }
        }
    }
}

@Composable
internal fun FormattedAIText(content: String, primary: Color) {
    val codeColor = Lime400
    val codeBg    = Color(0xFF1A2A1A)

    // ── Pass 1: split into fenced code blocks vs normal lines ────────
    val lines = content.split("\n")
    data class Segment(val text: String, val isCode: Boolean)
    val segments = mutableListOf<Segment>()
    var inCode = false
    val buf = StringBuilder()
    for (line in lines) {
        if (line.trimStart().startsWith("```")) {
            if (inCode) { segments += Segment(buf.toString().trimEnd('\n'), true); buf.clear(); inCode = false }
            else inCode = true
        } else {
            if (inCode) buf.append(line).append("\n")
            else segments += Segment(line, false)
        }
    }
    if (buf.isNotEmpty()) segments += Segment(buf.toString().trimEnd('\n'), true)

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        segments.forEach { (text, isCode) ->
            if (isCode) {
                Box(
                    modifier = Modifier.fillMaxWidth()
                        .background(codeBg, RoundedCornerShape(8.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp)
                ) {
                    Text(text, fontSize = 12.sp, fontFamily = FontFamily.Monospace,
                        color = codeColor, lineHeight = 18.sp)
                }
                return@forEach
            }

            // ── Check for [math-block]...[/math-block] on its own line ──
            val trimmed = text.trim()
            if (trimmed.startsWith("[math-block]") && trimmed.contains("[/math-block]")) {
                val expr = trimmed.removePrefix("[math-block]").substringBefore("[/math-block]").trim()
                MathText(expr, primary, isBlock = true)
                return@forEach
            }
            // Also handle legacy $$...$$ just in case
            if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) {
                val expr = trimmed.removePrefix("$$").removeSuffix("$$").trim()
                MathText(expr, primary, isBlock = true)
                return@forEach
            }

            val line = text
            when {
                line.isBlank() -> Spacer(modifier = Modifier.height(2.dp))

                line.trimStart().startsWith("# ") && !line.trimStart().startsWith("## ") -> {
                    Text(
                        inlineAnnotated(line.trimStart().removePrefix("# "), primary, codeColor),
                        fontSize = 17.sp, fontWeight = FontWeight.ExtraBold,
                        color = primary, lineHeight = 24.sp
                    )
                }
                line.trimStart().startsWith("## ") && !line.trimStart().startsWith("### ") -> {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        inlineAnnotated(line.trimStart().removePrefix("## "), primary, codeColor),
                        fontSize = 15.sp, fontWeight = FontWeight.Bold,
                        color = primary, lineHeight = 22.sp
                    )
                }
                line.trimStart().startsWith("### ") -> {
                    Text(
                        inlineAnnotated(line.trimStart().removePrefix("### "), primary, codeColor),
                        fontSize = 14.sp, fontWeight = FontWeight.Bold,
                        color = primary.copy(alpha = 0.85f), lineHeight = 20.sp
                    )
                }
                line.trimStart().firstOrNull()?.isDigit() == true && line.contains(". ") -> {
                    Row(verticalAlignment = Alignment.Top) {
                        Text(line.substringBefore(". ") + ".",
                            fontSize = 13.sp, color = primary, fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 1.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        InlineLatexText(line.substringAfter(". "), primary, codeColor)
                    }
                }
                line.trimStart().startsWith("- ") || line.trimStart().startsWith("\u2022 ") -> {
                    Row(verticalAlignment = Alignment.Top) {
                        Text("\u2022", fontSize = 14.sp, color = primary,
                            fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 1.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        InlineLatexText(
                            line.trimStart().removePrefix("- ").removePrefix("\u2022 "),
                            primary, codeColor
                        )
                    }
                }
                else -> InlineLatexText(line, primary, codeColor)
            }
        }
    }
}

/** Renders a line that may contain [math]...[/math] inline math mixed with plain text. */
@Composable
private fun InlineLatexText(text: String, primary: Color, codeColor: Color) {
    val parts = splitMathTags(text)
    val bodyColor = AppColors.textPrimary
    if (parts.size == 1 && !parts[0].second) {
        Text(inlineAnnotated(text, primary, codeColor), fontSize = 14.sp, color = bodyColor, lineHeight = 20.sp)
        return
    }
    Column {
        var pending = StringBuilder()
        parts.forEach { (content, isMath) ->
            if (isMath) {
                if (pending.isNotEmpty()) {
                    Text(inlineAnnotated(pending.toString(), primary, codeColor), fontSize = 14.sp, color = bodyColor, lineHeight = 20.sp)
                    pending = StringBuilder()
                }
                MathText(content, primary, isBlock = false)
            } else {
                pending.append(content)
            }
        }
        if (pending.isNotEmpty())
            Text(inlineAnnotated(pending.toString(), primary, codeColor), fontSize = 14.sp, color = bodyColor, lineHeight = 20.sp)
    }
}

/** Splits text on [math]...[/math] into (text, isMath) pairs. */
private fun splitMathTags(text: String): List<Pair<String, Boolean>> {
    val result = mutableListOf<Pair<String, Boolean>>()
    var remaining = text
    while (remaining.isNotEmpty()) {
        val start = remaining.indexOf("[math]")
        if (start == -1) { result.add(remaining to false); break }
        if (start > 0) result.add(remaining.substring(0, start) to false)
        val end = remaining.indexOf("[/math]", start + 6)
        if (end == -1) { result.add(remaining.substring(start) to false); break }
        result.add(remaining.substring(start + 6, end) to true)
        remaining = remaining.substring(end + 7)
    }
    return result.ifEmpty { listOf(text to false) }
}

/** Renders a math expression with monospace font, primary color and tinted background. */
@Composable
private fun MathText(expr: String, primary: Color, isBlock: Boolean) {
    val bg = primary.copy(alpha = 0.10f)
    if (isBlock) {
        Box(
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                .background(bg, RoundedCornerShape(8.dp))
                .padding(horizontal = 16.dp, vertical = 10.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(expr, fontSize = 16.sp, fontFamily = FontFamily.Monospace,
                color = primary, fontWeight = FontWeight.Bold, lineHeight = 22.sp)
        }
    } else {
        Text(
            text = buildAnnotatedString {
                pushStyle(SpanStyle(
                    fontFamily = FontFamily.Monospace,
                    color = primary,
                    background = bg,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp
                ))
                append(" $expr ")
                pop()
            },
            lineHeight = 20.sp
        )
    }
}

/**
 * Renders inline markdown spans within one line of text.
 * Order matters: **bold** must be matched before *italic* to avoid
 * the single-star pattern consuming the double-star markers.
 *
 * Supported:
 *   **text** or __text__  → bold + primary color
 *   *text*                → italic
 *   `text`                → monospace + lime + tinted background
 */
private fun inlineAnnotated(
    text: String,
    boldColor: Color,
    codeColor: Color
) = buildAnnotatedString {
    // Process the text character by character to correctly handle
    // **bold**, *italic*, `code` without regex ambiguity
    var i = 0
    while (i < text.length) {
        when {
            // ── **bold** ──────────────────────────────────────────────
            text.startsWith("**", i) -> {
                val end = text.indexOf("**", i + 2)
                if (end != -1) {
                    pushStyle(SpanStyle(fontWeight = FontWeight.Bold, color = boldColor))
                    append(text.substring(i + 2, end))
                    pop()
                    i = end + 2
                } else { append(text[i]); i++ }
            }
            // ── __bold__ ──────────────────────────────────────────────
            text.startsWith("__", i) -> {
                val end = text.indexOf("__", i + 2)
                if (end != -1) {
                    pushStyle(SpanStyle(fontWeight = FontWeight.Bold, color = boldColor))
                    append(text.substring(i + 2, end))
                    pop()
                    i = end + 2
                } else { append(text[i]); i++ }
            }
            // ── *italic* (only single star) ───────────────────────────
            text[i] == '*' && !text.startsWith("**", i) -> {
                val end = text.indexOf('*', i + 1)
                if (end != -1 && !text.startsWith("**", end)) {
                    pushStyle(SpanStyle(fontStyle = FontStyle.Italic))
                    append(text.substring(i + 1, end))
                    pop()
                    i = end + 1
                } else { append(text[i]); i++ }
            }
            // ── `inline code` ─────────────────────────────────────────
            text[i] == '`' -> {
                val end = text.indexOf('`', i + 1)
                if (end != -1) {
                    pushStyle(SpanStyle(
                        fontFamily = FontFamily.Monospace,
                        color = codeColor,
                        background = codeColor.copy(alpha = 0.15f),
                        fontSize = 12.sp
                    ))
                    append(text.substring(i + 1, end))
                    pop()
                    i = end + 1
                } else { append(text[i]); i++ }
            }
            else -> { append(text[i]); i++ }
        }
    }
}
