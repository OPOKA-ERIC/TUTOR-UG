package com.tutorug.app.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tutorug.app.data.model.ChatMessage
import com.tutorug.app.data.model.DocumentSection
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.theme.*

@Composable
fun LearningScreen(
    userProfile: UserProfile,
    sections: List<DocumentSection>,
    currentSectionIndex: Int,
    messages: List<ChatMessage>,
    isLoading: Boolean,
    isStreaming: Boolean,
    streamingText: String,
    allSectionsComplete: Boolean = false,
    errorMessage: String? = null,
    onSendMessage: (String, (() -> Unit)?) -> Unit,
    onVoiceInput: () -> Unit,
    onSectionComplete: () -> Unit,
    onBackClick: () -> Unit
) {
    var messageText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val currentSection = sections.getOrNull(currentSectionIndex)

    val bg           = AppColors.background
    val surface      = AppColors.surface
    val surfaceVar   = AppColors.surfaceVar
    val primary      = AppColors.primary
    val onPrimary    = AppColors.onPrimary
    val tertiary     = AppColors.tertiary
    val onSurfaceVar = AppColors.onSurfaceVar
    val barStart     = AppColors.barStart
    val barEnd       = AppColors.barEnd
    val error        = AppColors.error

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size) // +1 offset for the pinned intro card
    }

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
                        modifier = Modifier.size(48.dp).noRippleClickable { onBackClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.ArrowBack, null, tint = TextWhite)
                    }
                    AppLogo()
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            currentSection?.title ?: "Learning",
                            fontSize = 14.sp, fontWeight = FontWeight.Bold,
                            color = TextWhite, maxLines = 1
                        )
                        Text(
                            "Section ${currentSectionIndex + 1} of ${sections.size}",
                            fontSize = 11.sp, color = onSurfaceVar
                        )
                    }
                    // Section progress dots
                    Row(
                        modifier = Modifier.padding(end = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        sections.forEachIndexed { i, _ ->
                            Box(
                                modifier = Modifier
                                    .size(if (i == currentSectionIndex) 10.dp else 7.dp)
                                    .background(
                                        when {
                                            i < currentSectionIndex -> Lime400
                                            i == currentSectionIndex -> primary
                                            else -> onSurfaceVar.copy(alpha = 0.3f)
                                        },
                                        CircleShape
                                    )
                            )
                        }
                    }
                }
            }

            // ── MESSAGES ─────────────────────────────────────────────
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp),
                state = listState,
                contentPadding = PaddingValues(vertical = 12.dp)
            ) {
                // Always show section intro card as the first item
                if (currentSection != null) {
                    item {
                        if (messages.isEmpty() && isLoading) {
                            // Session is still being created — show a spinner instead of the intro
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(color = primary, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
                            }
                        } else {
                            SectionIntroCard(currentSection, primary, surface, surfaceVar, onSurfaceVar)
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                }

                items(messages) { message ->
                    ChatBubble(message, primary, onPrimary, surface, surfaceVar)
                    Spacer(modifier = Modifier.height(10.dp))
                }

                // Thinking dots
                if (isLoading) {
                    item {
                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            horizontalArrangement = Arrangement.Start,
                            verticalAlignment = Alignment.Bottom) {
                            Box(
                                modifier = Modifier.size(32.dp)
                                    .background(Brush.linearGradient(listOf(Amber400, Violet600)), CircleShape),
                                contentAlignment = Alignment.Center
                            ) { Text("AI", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White) }
                            Spacer(modifier = Modifier.width(8.dp))
                            Surface(shape = RoundedCornerShape(4.dp, 18.dp, 18.dp, 18.dp), color = surface) {
                                Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                    repeat(3) { i ->
                                        val infiniteTransition = rememberInfiniteTransition(label = "dot$i")
                                        val dotAlpha by infiniteTransition.animateFloat(
                                            initialValue = 0.2f, targetValue = 1f,
                                            animationSpec = infiniteRepeatable(tween(500, delayMillis = i * 150), RepeatMode.Reverse),
                                            label = "dot$i"
                                        )
                                        Box(modifier = Modifier.size(7.dp).alpha(dotAlpha).background(primary, CircleShape))
                                        if (i < 2) Spacer(modifier = Modifier.width(4.dp))
                                    }
                                }
                            }
                        }
                    }
                }

                // Streaming bubble
                if (isStreaming && streamingText.isNotBlank()) {
                    item {
                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.Start,
                            verticalAlignment = Alignment.Bottom) {
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
                                    FormattedAIText(streamingText + if (cursorAlpha > 0.5f) "█" else " ", primary)
                                }
                            }
                        }
                    }
                }

                // Quiz button — only after the AI has given at least one explanation response
                val aiHasExplained = messages.any { it.role == "assistant" }
                val isLastSection = currentSectionIndex == sections.size - 1

                if (aiHasExplained && !isLoading && !isStreaming) {
                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        if (allSectionsComplete) {
                            // All sections done — no more quiz button
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                color = Lime500.copy(alpha = 0.08f)
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text("\uD83C\uDF89", fontSize = 32.sp)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        "You've completed all ${sections.size} sections!",
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Lime500,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        "Great work! Go back to your chat history to review or upload a new document.",
                                        fontSize = 12.sp,
                                        color = onSurfaceVar,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        } else {
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                color = primary.copy(alpha = 0.06f)
                            ) {
                                Column(
                                    modifier = Modifier.padding(14.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        if (isLastSection)
                                            "This is the last section. Take the final quiz when you're ready!"
                                        else
                                            "When you feel ready, tap below to take the quiz for this section.",
                                        fontSize = 11.sp,
                                        color = onSurfaceVar,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Button(
                                        onClick = onSectionComplete,
                                        modifier = Modifier.fillMaxWidth().height(46.dp),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                                        contentPadding = PaddingValues(0.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier.fillMaxSize()
                                                .background(
                                                    Brush.linearGradient(
                                                        if (isLastSection) listOf(Amber500, Amber600)
                                                        else listOf(Lime400, Lime600)
                                                    ),
                                                    RoundedCornerShape(12.dp)
                                                ),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Icon(Icons.Default.Quiz, null, tint = Ink900, modifier = Modifier.size(18.dp))
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text(
                                                    if (isLastSection) "I'm Ready — Final Quiz 🏆"
                                                    else "I'm Ready — Take Quiz",
                                                    fontSize = 14.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Ink900
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
            }

            // ── ERROR BAR ─────────────────────────────────────────────
            if (errorMessage != null) {
                Surface(modifier = Modifier.fillMaxWidth(), color = error.copy(alpha = 0.9f)) {
                    Text(errorMessage, color = TextWhite, fontSize = 13.sp,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
                }
            }

            // ── INPUT BAR ────────────────────────────────────────────
            Box(
                modifier = Modifier.fillMaxWidth().navigationBarsPadding().imePadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Box(
                    modifier = Modifier.fillMaxWidth()
                        .background(Brush.linearGradient(listOf(surfaceVar, surface)), RoundedCornerShape(32.dp))
                        .border(1.5.dp,
                            Brush.linearGradient(listOf(primary.copy(alpha = 0.7f), tertiary.copy(alpha = 0.5f))),
                            RoundedCornerShape(32.dp))
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier.size(40.dp)
                                .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape)
                                .noRippleClickable { onVoiceInput() },
                            contentAlignment = Alignment.Center
                        ) { Icon(Icons.Default.Mic, null, tint = onPrimary, modifier = Modifier.size(20.dp)) }
                        Spacer(modifier = Modifier.width(8.dp))
                        BasicTextField(
                            value = messageText,
                            onValueChange = { messageText = it },
                            modifier = Modifier.weight(1f),
                            textStyle = TextStyle(color = TextWhite, fontSize = 14.sp),
                            cursorBrush = Brush.linearGradient(listOf(primary, tertiary)),
                            maxLines = 4,
                            decorationBox = { inner ->
                                if (messageText.isEmpty()) {
                                    Text("Ask a question about this section...",
                                        color = TextDisabled, fontSize = 14.sp)
                                }
                                inner()
                            }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        val canSend = messageText.isNotBlank() && !isLoading && !isStreaming
                        Box(
                            modifier = Modifier.size(40.dp)
                                .background(
                                    if (canSend) Brush.linearGradient(listOf(tertiary, Violet600))
                                    else Brush.linearGradient(listOf(surfaceVar, surfaceVar)),
                                    CircleShape
                                )
                                .noRippleClickable {
                                    if (canSend) {
                                        val text = messageText
                                        messageText = ""
                                        onSendMessage(text, onSectionComplete)
                                    }
                                },
                            contentAlignment = Alignment.Center
                        ) { Icon(Icons.Default.Send, null, tint = TextWhite, modifier = Modifier.size(20.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionIntroCard(
    section: DocumentSection,
    primary: Color,
    surface: Color,
    surfaceVar: Color,
    onSurfaceVar: Color
) {
    Column {
        // AI intro bubble
        Row(verticalAlignment = Alignment.Bottom) {
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
                Box(
                    modifier = Modifier
                        .border(1.dp,
                            Brush.linearGradient(listOf(primary.copy(alpha = 0.5f), Violet400.copy(alpha = 0.3f))),
                            RoundedCornerShape(4.dp, 18.dp, 18.dp, 18.dp))
                        .background(Brush.linearGradient(listOf(surface, surfaceVar)),
                            RoundedCornerShape(4.dp, 18.dp, 18.dp, 18.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp)
                ) {
                    Column {
                        Text("Let's study: ${section.title}",
                            fontSize = 13.sp, fontWeight = FontWeight.Bold, color = primary)
                        Spacer(modifier = Modifier.height(8.dp))
                        FormattedAIText(section.content, primary)
                        Spacer(modifier = Modifier.height(10.dp))
                        Text("Feel free to ask me any questions about this section!",
                            fontSize = 12.sp, color = onSurfaceVar)
                    }
                }
            }
        }
    }
}
