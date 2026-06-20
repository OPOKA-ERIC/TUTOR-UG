package com.tutorug.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tutorug.app.data.model.PodcastSegment
import com.tutorug.app.data.model.PodcastSession
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.theme.*
import com.tutorug.app.util.VoiceManager
import com.tutorug.app.viewmodel.PodcastViewModel

@Composable
fun PodcastScreen(
    userProfile: UserProfile,
    viewModel: PodcastViewModel,
    voiceManager: VoiceManager,
    onBackClick: () -> Unit
) {
    val script by viewModel.script.collectAsState()
    val history by viewModel.history.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val followUpLoading by viewModel.followUpLoading.collectAsState()
    val currentTopic by viewModel.currentTopic.collectAsState()

    val primary = AppColors.primary
    val surface = AppColors.surface
    val surfaceVar = AppColors.surfaceVar
    val onSurfaceVar = AppColors.onSurfaceVar

    var topic by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("") }
    var followUp by remember { mutableStateOf("") }
    var speakingIdx by remember { mutableStateOf<Int?>(null) }
    var playingAll by remember { mutableStateOf(false) }

    val listState = rememberLazyListState()
    LaunchedEffect(script.size) {
        if (script.isNotEmpty()) listState.animateScrollToItem(script.size - 1)
    }
    LaunchedEffect(Unit) { viewModel.loadHistory(userProfile.userId) }

    fun speakSegment(idx: Int, text: String) {
        if (speakingIdx == idx) { voiceManager.stopSpeaking(); speakingIdx = null; return }
        voiceManager.stopSpeaking()
        voiceManager.speak(text)
        speakingIdx = idx
    }

    fun stopAll() { voiceManager.stopSpeaking(); speakingIdx = null; playingAll = false }

    fun playAll() {
        if (script.isEmpty()) return
        playingAll = true
        var idx = 0
        fun playNext() {
            if (idx >= script.size) { speakingIdx = null; playingAll = false; return }
            speakingIdx = idx
            voiceManager.speak(script[idx].text, onDone = {
                idx++
                playNext()
            })
        }
        voiceManager.stopSpeaking()
        playNext()
    }

    Column(
        modifier = Modifier.fillMaxSize()
            .background(Brush.verticalGradient(listOf(surface, AppColors.background)))
            .statusBarsPadding()
    ) {
        // Top bar
        Row(
            modifier = Modifier.fillMaxWidth()
                .background(Brush.horizontalGradient(listOf(AppColors.barStart, AppColors.barEnd)))
                .padding(horizontal = 4.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = { stopAll(); onBackClick() }, modifier = Modifier.size(48.dp)) {
                Box(modifier = Modifier.size(36.dp).background(AppColors.surfaceInput, CircleShape),
                    contentAlignment = Alignment.Center) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = AppColors.textPrimary, modifier = Modifier.size(18.dp))
                }
            }
            Box(modifier = Modifier.size(34.dp)
                .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape),
                contentAlignment = Alignment.Center) {
                Text("🎙", fontSize = 16.sp)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text("AI Podcast", color = AppColors.textPrimary, fontWeight = FontWeight.Bold,
                fontSize = 17.sp, modifier = Modifier.weight(1f))
            if (script.isNotEmpty()) {
                val isPlaying = playingAll || speakingIdx != null
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = (if (isPlaying) AppColors.error else primary).copy(0.15f),
                    modifier = Modifier.clickable { if (isPlaying) stopAll() else playAll() }
                ) {
                    Row(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(if (isPlaying) Icons.Default.Stop else Icons.Default.PlayArrow,
                            null,
                            tint = if (isPlaying) AppColors.error else primary,
                            modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(if (isPlaying) "Stop" else "Play All",
                            color = if (isPlaying) AppColors.error else primary,
                            fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(modifier = Modifier.width(8.dp))
            }
        }

        LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp),
            state = listState, verticalArrangement = Arrangement.spacedBy(12.dp)) {

            // Generate form or header
            if (script.isEmpty()) {
                item {
                    Surface(shape = RoundedCornerShape(16.dp), color = surface,
                        modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("🎙️ Generate a Learning Podcast", color = AppColors.textPrimary,
                                fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text("TutorUG AI creates an interactive podcast episode between a HOST and you on any topic you're studying.",
                                color = onSurfaceVar, fontSize = 12.sp, lineHeight = 18.sp)
                            BasicTextInput(value = topic, onValue = { topic = it },
                                placeholder = "Topic (e.g. Photosynthesis, Quadratic Equations) *")
                            BasicTextInput(value = subject, onValue = { subject = it },
                                placeholder = "Subject (e.g. Biology, Mathematics)")
                            Button(
                                onClick = {
                                    if (topic.isNotBlank()) viewModel.generate(topic, subject, userProfile)
                                },
                                enabled = topic.isNotBlank() && !loading,
                                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                                contentPadding = PaddingValues(0.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Box(modifier = Modifier.fillMaxWidth().height(44.dp)
                                    .background(
                                        if (topic.isNotBlank()) Brush.linearGradient(listOf(Amber400, Amber600))
                                        else Brush.linearGradient(listOf(surfaceVar, surfaceVar)),
                                        RoundedCornerShape(12.dp)),
                                    contentAlignment = Alignment.Center) {
                                    if (loading) CircularProgressIndicator(color = AppColors.onPrimary, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                                    else Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.Mic, null, tint = AppColors.onPrimary, modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("Generate Podcast", color = AppColors.onPrimary, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }

                if (history.isNotEmpty()) {
                    item {
                        Text("PAST PODCASTS", color = onSurfaceVar, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                    items(history) { session ->
                        PodcastHistoryCard(session = session, primary = primary, surface = surface,
                            onSurfaceVar = onSurfaceVar, onClick = { viewModel.loadSession(session) })
                    }
                }
            } else {
                // Topic header
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("NOW PLAYING", color = onSurfaceVar, fontSize = 10.sp, fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f))
                        Surface(shape = RoundedCornerShape(8.dp), color = surfaceVar,
                            modifier = Modifier.clickable { viewModel.reset(); stopAll() }) {
                            Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Add, null, tint = onSurfaceVar, modifier = Modifier.size(13.dp))
                                Spacer(modifier = Modifier.width(3.dp))
                                Text("New Topic", color = onSurfaceVar, fontSize = 11.sp)
                            }
                        }
                    }
                    Text(currentTopic, color = AppColors.textPrimary, fontWeight = FontWeight.Bold,
                        fontSize = 14.sp, modifier = Modifier.padding(top = 2.dp))
                }

                // Script segments
                items(script.size) { idx ->
                    val seg = script[idx]
                    PodcastSegmentBubble(
                        seg = seg, userName = userProfile.name,
                        isPlaying = speakingIdx == idx,
                        primary = primary, surface = surface, surfaceVar = surfaceVar, onSurfaceVar = onSurfaceVar,
                        onSpeak = { speakSegment(idx, seg.text) }
                    )
                }

                // Follow-up
                item {
                    Surface(shape = RoundedCornerShape(14.dp), color = surface,
                        modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("💬 Ask a follow-up question", color = AppColors.textPrimary,
                                fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(modifier = Modifier.weight(1f)
                                    .background(AppColors.surfaceInput, RoundedCornerShape(10.dp))
                                    .border(1.dp, AppColors.outline, RoundedCornerShape(10.dp))
                                    .padding(horizontal = 12.dp, vertical = 10.dp)) {
                                    if (followUp.isEmpty()) Text("What else do you want to know?",
                                        color = AppColors.textDisabled, fontSize = 13.sp)
                                    BasicTextField(
                                        value = followUp, onValueChange = { followUp = it },
                                        textStyle = TextStyle(color = AppColors.textPrimary, fontSize = 13.sp),
                                        modifier = Modifier.fillMaxWidth(),
                                        cursorBrush = Brush.linearGradient(listOf(primary, Violet400))
                                    )
                                }
                                IconButton(
                                    onClick = {
                                        if (followUp.isNotBlank()) {
                                            viewModel.followUp(followUp.trim(), userProfile)
                                            followUp = ""
                                        }
                                    },
                                    enabled = followUp.isNotBlank() && !followUpLoading,
                                    modifier = Modifier.size(42.dp)
                                        .background(
                                            if (followUp.isNotBlank()) Brush.linearGradient(listOf(Violet500, Violet600))
                                            else Brush.linearGradient(listOf(surfaceVar, surfaceVar)),
                                            CircleShape
                                        )
                                ) {
                                    if (followUpLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                                    else Icon(Icons.Default.Mic, null, tint = AppColors.textPrimary, modifier = Modifier.size(20.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PodcastSegmentBubble(
    seg: PodcastSegment, userName: String,
    isPlaying: Boolean, primary: Color, surface: Color, surfaceVar: Color, onSurfaceVar: Color,
    onSpeak: () -> Unit
) {
    val isHost = seg.speaker == "HOST"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isHost) Arrangement.Start else Arrangement.End,
        verticalAlignment = Alignment.Bottom
    ) {
        if (isHost) {
            Box(modifier = Modifier.size(36.dp)
                .background(Brush.linearGradient(listOf(Violet500, Violet600)), CircleShape),
                contentAlignment = Alignment.Center) {
                Text("AI", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
            Spacer(modifier = Modifier.width(8.dp))
        }
        Column(modifier = Modifier.widthIn(max = 280.dp)) {
            Text(if (isHost) "TutorUG HOST" else userName,
                color = if (isHost) Violet400 else primary,
                fontSize = 11.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 3.dp, start = 2.dp))
            Box(modifier = Modifier
                .background(
                    if (isHost) Brush.linearGradient(listOf(surface, AppColors.surfaceVar))
                    else Brush.linearGradient(listOf(Amber500.copy(0.3f), Amber600.copy(0.2f))),
                    if (isHost) RoundedCornerShape(4.dp, 16.dp, 16.dp, 16.dp)
                    else RoundedCornerShape(16.dp, 4.dp, 16.dp, 16.dp)
                )
                .border(1.dp,
                    if (isHost) Violet400.copy(0.3f) else primary.copy(0.3f),
                    if (isHost) RoundedCornerShape(4.dp, 16.dp, 16.dp, 16.dp)
                    else RoundedCornerShape(16.dp, 4.dp, 16.dp, 16.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp)
            ) {
                Text(seg.text, fontSize = 13.sp, color = AppColors.textPrimary, lineHeight = 19.sp)
            }
            // Speak button
            Row(modifier = Modifier.padding(top = 4.dp, start = 2.dp),
                horizontalArrangement = if (isHost) Arrangement.Start else Arrangement.End) {
                Surface(shape = RoundedCornerShape(6.dp),
                    color = if (isPlaying) AppColors.error.copy(0.12f) else surfaceVar.copy(0.6f),
                    modifier = Modifier.clickable { onSpeak() }) {
                    Row(modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(if (isPlaying) Icons.Default.StopCircle else Icons.AutoMirrored.Filled.VolumeUp,
                            null,
                            tint = if (isPlaying) AppColors.error else onSurfaceVar,
                            modifier = Modifier.size(12.dp))
                        Spacer(modifier = Modifier.width(3.dp))
                        Text(if (isPlaying) "Stop" else "Listen", color = onSurfaceVar, fontSize = 10.sp)
                    }
                }
            }
        }
        if (!isHost) {
            Spacer(modifier = Modifier.width(8.dp))
            Box(modifier = Modifier.size(36.dp)
                .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape),
                contentAlignment = Alignment.Center) {
                Text("Me", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color(0xFF1A1A1A))
            }
        }
    }
}

@Composable
private fun PodcastHistoryCard(
    session: PodcastSession, primary: Color, surface: Color,
    onSurfaceVar: Color, onClick: () -> Unit
) {
    Surface(shape = RoundedCornerShape(12.dp), color = surface,
        modifier = Modifier.fillMaxWidth()
            .border(1.dp, primary.copy(0.1f), RoundedCornerShape(12.dp))
            .clickable { onClick() }) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("🎙️", fontSize = 22.sp)
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(session.topic, color = AppColors.textPrimary, fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp, maxLines = 1)
                Text("${session.subject.ifBlank { "General" }} · ${session.script.size} segments",
                    color = onSurfaceVar, fontSize = 11.sp)
            }
            Icon(Icons.Default.PlayCircleOutline, null, tint = primary, modifier = Modifier.size(22.dp))
        }
    }
}
