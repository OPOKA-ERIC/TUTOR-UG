package com.tutorug.app.ui.screens

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tutorug.app.data.model.PodcastSegment
import com.tutorug.app.data.model.PodcastSession
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.theme.*
import com.tutorug.app.util.VoiceManager
import com.tutorug.app.util.VoiceRole
import com.tutorug.app.viewmodel.PodcastViewModel

private enum class Playback { IDLE, PLAYING, PAUSED }

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
val hasSources by viewModel.grounded.collectAsState()

    val primary = AppColors.primary
    val surface = AppColors.surface
    val surfaceVar = AppColors.surfaceVar
    val onSurfaceVar = AppColors.onSurfaceVar

    var topic by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("") }
    var followUp by remember { mutableStateOf("") }

    var playback by remember { mutableStateOf(Playback.IDLE) }
    var activeIdx by remember { mutableStateOf(-1) }
    var ttsReady by remember { mutableStateOf(false) }

    val listState = rememberLazyListState()

    LaunchedEffect(Unit) {
        // The profile is the source of truth for the student voice. Settings is
        // applied by MainActivity, but the profile lets a signed-in learner get
        // the right voice before they ever open Settings.
        val g = userProfile.gender.trim().lowercase()
        if (g == "male" || g == "female") voiceManager.setStudentIsMale(g == "male")
        voiceManager.initializeTTS { ttsReady = true }
        viewModel.loadHistory(userProfile.userId)
    }

    // Keep the active turn in view while the episode plays.
    LaunchedEffect(activeIdx) {
        if (activeIdx >= 0 && activeIdx < script.size) {
            runCatching { listState.animateScrollToItem(activeIdx + 1) }
        }
    }

    DisposableEffect(Unit) {
        onDispose { voiceManager.stopSpeaking() }
    }

    fun roleFor(speaker: String): VoiceRole =
        if (speaker.equals("STUDENT", ignoreCase = true)) VoiceRole.STUDENT else VoiceRole.HOST

    /*
     * Each turn is queued as a list of sentence-sized utterances rather than one
     * blob. Android TTS has no true pause, so the only honest way to resume is to
     * replay from the last utterance boundary. Splitting by sentence means play
     * after pause continues mid-sentence instead of restarting the whole turn.
     */
    val utterances = remember(script) {
        val out = mutableListOf<Utterance>()
        script.forEachIndexed { segIdx, seg ->
            splitForSpeech(seg.text).forEach { piece ->
                out.add(Utterance(piece, segIdx, seg.speaker))
            }
        }
        out
    }

    var cursor by remember { mutableStateOf(-1) }

    /**
     * Speaks utterances [start] until [endExclusive]. Reads `playback` on every
     * hop so a pause takes effect immediately even if a stale engine callback
     * arrives from the utterance we just cut off.
     */
    fun runQueue(start: Int, endExclusive: Int) {
        if (utterances.isEmpty()) return
        voiceManager.stopSpeaking()
        playback = Playback.PLAYING

        fun step(i: Int) {
            if (playback != Playback.PLAYING) return
            if (i >= endExclusive || i >= utterances.size) {
                cursor = -1
                activeIdx = -1
                playback = Playback.IDLE
                return
            }
            cursor = i
            activeIdx = utterances[i].segIdx
            val u = utterances[i]
            voiceManager.speakAs(u.text, roleFor(u.speaker)) { step(i + 1) }
        }

        step(start.coerceIn(0, utterances.lastIndex))
    }

    fun playFromUtterance(start: Int) = runQueue(start, utterances.size)

    /** Plays one turn only, then stops, used by the per-bubble "Hear this turn" action. */
    fun playSegment(segIdx: Int) {
        val first = utterances.indexOfFirst { it.segIdx == segIdx }
        if (first < 0) return
        val last = utterances.indexOfLast { it.segIdx == segIdx }
        runQueue(first, last + 1)
    }

    fun togglePlayPause() {
        when (playback) {
            Playback.PLAYING -> {
                voiceManager.pauseSpeaking()
                playback = Playback.PAUSED
            }
            Playback.PAUSED -> {
                if (cursor in utterances.indices) playFromUtterance(cursor) else playFromUtterance(0)
            }
            Playback.IDLE -> playFromUtterance(if (cursor >= 0) cursor else 0)
        }
    }

    fun stopAll() {
        voiceManager.stopSpeaking()
        playback = Playback.IDLE
        activeIdx = -1
        cursor = -1
    }

    fun playSingle(idx: Int) {
        if (playback == Playback.PLAYING && activeIdx == idx) {
            voiceManager.pauseSpeaking()
            playback = Playback.PAUSED
            return
        }
        playSegment(idx)
    }

    Column(
        modifier = Modifier.fillMaxSize()
            .background(Brush.verticalGradient(listOf(surface, AppColors.background)))
            .statusBarsPadding()
    ) {
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
            Column(modifier = Modifier.weight(1f)) {
                Text("AI Podcast", color = AppColors.textPrimary, fontWeight = FontWeight.Bold,
                    fontSize = 17.sp)
                Text(
                    if (script.isEmpty()) "Two hosts, your own notes"
                    else "${script.size} turns \u00b7 ${script.count { it.speaker == "HOST" }}/${script.count { it.speaker == "STUDENT" }} host/student",
                    color = onSurfaceVar, fontSize = 10.sp
                )
            }
            if (script.isNotEmpty()) {
                PodcastTransport(
                    playback = playback,
                    hasVoice = ttsReady,
                    onPlayPause = ::togglePlayPause,
                    onStop = ::stopAll
                )
                Spacer(modifier = Modifier.width(6.dp))
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp),
            state = listState, verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {

            if (script.isEmpty()) {
                item {
                    Surface(shape = RoundedCornerShape(16.dp), color = surface,
                        modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("🎙️ Generate a Learning Podcast", color = AppColors.textPrimary,
                                fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text("A HOST and a student discuss your topic out loud. The AI reads your own uploaded notes, so the conversation is about your material, not a generic summary.",
                                color = onSurfaceVar, fontSize = 12.sp, lineHeight = 18.sp)
                            BasicTextField(
                                value = topic, onValueChange = { topic = it },
                                textStyle = TextStyle(color = AppColors.textPrimary, fontSize = 14.sp),
                                cursorBrush = Brush.linearGradient(listOf(primary, Violet400)),
                                modifier = Modifier.fillMaxWidth(),
                                decorationBox = { inner ->
                                    if (topic.isEmpty()) Text("Topic (e.g. Photosynthesis, Quadratic Equations) *",
                                        color = AppColors.textDisabled, fontSize = 14.sp)
                                    inner()
                                }
                            )
                            BasicTextField(
                                value = subject, onValueChange = { subject = it },
                                textStyle = TextStyle(color = AppColors.textPrimary, fontSize = 14.sp),
                                cursorBrush = Brush.linearGradient(listOf(primary, Violet400)),
                                modifier = Modifier.fillMaxWidth(),
                                decorationBox = { inner ->
                                    if (subject.isEmpty()) Text("Subject (e.g. Biology, Mathematics)",
                                        color = AppColors.textDisabled, fontSize = 14.sp)
                                    inner()
                                }
                            )
                            Button(
                                onClick = {
                                    if (topic.isNotBlank()) {
                                        stopAll()
                                        viewModel.generate(topic, subject, userProfile)
                                    }
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
                    item { Text("PAST PODCASTS", color = onSurfaceVar, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                    items(history) { session ->
                        PodcastHistoryCard(session = session, primary = primary, surface = surface,
                            onSurfaceVar = onSurfaceVar, onClick = {
                                stopAll(); viewModel.loadSession(session)
                            })
                    }
                }
            } else {
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
                        fontSize = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp))
                }

                // Large controls so the student can drive playback without hunting.
                item {
                    NowPlayingBar(
                        playback = playback,
                        activeIdx = activeIdx,
                        total = script.size,
                        speaker = if (activeIdx in script.indices) script[activeIdx].speaker else "",
                        hasSources = hasSources,
                        onPlayPause = ::togglePlayPause,
                        onStop = ::stopAll
                    )
                }

                items(script.size) { idx ->
                    val seg = script[idx]
                    PodcastSegmentBubble(
                        seg = seg, userName = userProfile.name,
                        isActive = activeIdx == idx,
                        isPast = activeIdx > idx,
                        primary = primary, surface = surface, surfaceVar = surfaceVar,
                        onSurfaceVar = onSurfaceVar,
                        onSpeak = { playSingle(idx) }
                    )
                }

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

/** Compact play / pause / stop cluster for the app bar. */
@Composable
private fun PodcastTransport(
    playback: Playback,
    hasVoice: Boolean,
    onPlayPause: () -> Unit,
    onStop: () -> Unit
) {
    val active = playback == Playback.PLAYING
    Row(verticalAlignment = Alignment.CenterVertically) {
        TransportButton(
            onClick = onPlayPause,
            enabled = hasVoice,
   background = if (active) Color(0x33FFB800) else Color(0x26FFB800)
   ) {
            Icon(
                when (playback) {
                    Playback.PLAYING -> Icons.Default.Pause
                    Playback.PAUSED -> Icons.Default.PlayArrow
                    Playback.IDLE -> Icons.Default.PlayArrow
                },
                contentDescription = when (playback) {
                    Playback.PLAYING -> "Pause"
                    else -> "Play"
                },
                tint = Amber400, modifier = Modifier.size(17.dp)
            )
        }
        Spacer(modifier = Modifier.width(5.dp))
        TransportButton(
            onClick = onStop,
            enabled = playback != Playback.IDLE,
   background = if (playback != Playback.IDLE) Color(0x33EF4444) else Color(0x14EF4444)
   ) {
            Icon(Icons.Default.Stop, contentDescription = "Stop", tint = AppColors.error,
                modifier = Modifier.size(15.dp))
        }
    }
}

@Composable
private fun TransportButton(
    onClick: () -> Unit,
    enabled: Boolean,
    background: Color,
    content: @Composable () -> Unit
) {
    Box(
        modifier = Modifier.size(34.dp)
            .clip(CircleShape)
            .background(background)
            .alpha(if (enabled) 1f else 0.4f)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) { content() }
}

/** Full-width transport shown above the transcript. */
@Composable
private fun NowPlayingBar(
        playback: Playback,
        activeIdx: Int,
        total: Int,
        speaker: String,
        hasSources: Boolean,
        onPlayPause: () -> Unit,
        onStop: () -> Unit
    ) {
    val transition = rememberInfiniteTransition(label = "pulse")
    val pulse by transition.animateFloat(
        initialValue = 0.45f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(750), RepeatMode.Reverse), label = "alpha"
    )
    val active = playback == Playback.PLAYING
    val isHost = speaker.equals("HOST", ignoreCase = true)
    val accent = if (activeIdx < 0) primaryColorFallback() else if (isHost) Violet400 else Amber500
    val progress = if (total > 0 && activeIdx >= 0) (activeIdx + 1f) / total else 0f

    Surface(shape = RoundedCornerShape(16.dp), color = AppColors.surface,
        modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {

            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(38.dp)
                    .background(Brush.linearGradient(listOf(accent, accent.copy(alpha = 0.6f))), CircleShape),
                    contentAlignment = Alignment.Center) {
                    if (active) {
                        Text("🔊", fontSize = 15.sp, modifier = Modifier.alpha(pulse))
                    } else {
                        Text("⏸", fontSize = 14.sp)
                    }
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        when (playback) {
                            Playback.PLAYING -> if (isHost) "TutorUG HOST is speaking" else "${speaker.lowercase().replaceFirstChar { it.uppercase() }} is speaking"
                            Playback.PAUSED -> "Paused on turn ${activeIdx + 1}"
                            Playback.IDLE -> "Ready \u00b7 ${total} turns"
                        },
                        color = AppColors.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        if (hasSources) "Two different voices \u00b7 grounded in your notes"
                        else "Two different voices \u00b7 syllabus based",
                        color = onSurfaceColor(), fontSize = 10.sp
                    )
                }
                Text("${activeIdx + 1}/$total", color = onSurfaceColor(), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }

            // Progress through the episode.
            Box(modifier = Modifier.fillMaxWidth().height(4.dp)
                .background(AppColors.surfaceInput, RoundedCornerShape(2.dp))) {
                Box(modifier = Modifier.fillMaxWidth(progress.coerceIn(0f, 1f)).height(4.dp)
                    .background(Brush.horizontalGradient(listOf(Violet500, Amber500)),
                        RoundedCornerShape(2.dp)))
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                // Primary play / pause
                Box(modifier = Modifier.weight(1f).height(42.dp)
                    .background(Brush.horizontalGradient(listOf(Violet500, Violet600)), RoundedCornerShape(12.dp))
                    .clickable { onPlayPause() },
                    contentAlignment = Alignment.Center) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            if (active) Icons.Default.Pause else Icons.Default.PlayArrow,
                            null, tint = Color.White, modifier = Modifier.size(19.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            when (playback) {
                                Playback.PLAYING -> "Pause"
                                Playback.PAUSED -> "Resume"
                                Playback.IDLE -> "Play episode"
                            },
                            color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold
                        )
                    }
                }
                // Stop
                Row(modifier = Modifier.height(42.dp)
                    .background(
                        if (playback != Playback.IDLE) Color(0x33EF4444) else AppColors.surfaceInput,
                        RoundedCornerShape(12.dp)
                    )
                    .border(
                        1.dp,
                        if (playback != Playback.IDLE) Color(0x66EF4444) else AppColors.outline,
                        RoundedCornerShape(12.dp)
                    )
                    .clickable(enabled = playback != Playback.IDLE) { onStop() }
                    .padding(horizontal = 18.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Stop, null, tint = AppColors.error, modifier = Modifier.size(17.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Stop", color = AppColors.error, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

private fun primaryColorFallback() = Violet400
private fun onSurfaceColor() = Color(0xFF9AA0A6)

@Composable
private fun PodcastSegmentBubble(
    seg: PodcastSegment, userName: String,
    isActive: Boolean, isPast: Boolean,
    primary: Color, surface: Color, surfaceVar: Color, onSurfaceVar: Color,
    onSpeak: () -> Unit
) {
    val isHost = seg.speaker.equals("HOST", ignoreCase = true)
    val transition = rememberInfiniteTransition(label = "bubble")
    val glow by transition.animateFloat(
        initialValue = 0.35f, targetValue = 0.85f,
        animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse), label = "glow"
    )

    Row(
        modifier = Modifier.fillMaxWidth().alpha(if (isPast && !isActive) 0.55f else 1f),
        horizontalArrangement = if (isHost) Arrangement.Start else Arrangement.End,
        verticalAlignment = Alignment.Bottom
    ) {
        if (isHost) {
            Box(modifier = Modifier.size(36.dp)
                .background(Brush.linearGradient(listOf(Violet500, Violet600)), CircleShape)
                .then(if (isActive) Modifier.alpha(glow) else Modifier),
                contentAlignment = Alignment.Center) {
                Text("AI", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
            Spacer(modifier = Modifier.width(8.dp))
        }
        Column(modifier = Modifier.widthIn(max = 280.dp)) {
            Text(
                if (isHost) "TutorUG HOST" else userName,
                color = if (isHost) Violet400 else primary,
                fontSize = 11.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 3.dp, start = 2.dp)
            )
            Box(modifier = Modifier
                .background(
                    if (isHost) Brush.linearGradient(listOf(surface, AppColors.surfaceVar))
                    else Brush.linearGradient(listOf(Amber500.copy(0.3f), Amber600.copy(0.2f))),
                    if (isHost) RoundedCornerShape(4.dp, 16.dp, 16.dp, 16.dp)
                    else RoundedCornerShape(16.dp, 4.dp, 16.dp, 16.dp)
                )
                .border(
                    if (isActive) 1.5.dp else 1.dp,
                    when {
                        isActive && isHost -> Violet400
                        isActive -> Amber500
                        isHost -> Violet400.copy(0.3f)
                        else -> primary.copy(0.3f)
                    },
                    if (isHost) RoundedCornerShape(4.dp, 16.dp, 16.dp, 16.dp)
                    else RoundedCornerShape(16.dp, 4.dp, 16.dp, 16.dp)
                )
                .padding(horizontal = 14.dp, vertical = 10.dp)
            ) {
                Text(seg.text, fontSize = 13.sp, color = AppColors.textPrimary, lineHeight = 19.sp)
            }
            Row(modifier = Modifier.padding(top = 4.dp, start = 2.dp),
                horizontalArrangement = if (isHost) Arrangement.Start else Arrangement.End) {
                Surface(shape = RoundedCornerShape(6.dp),
                    color = if (isActive) AppColors.error.copy(0.12f) else surfaceVar.copy(0.6f),
                    modifier = Modifier.clickable { onSpeak() }) {
                    Row(modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Icon(if (isActive) Icons.Default.StopCircle else Icons.AutoMirrored.Filled.VolumeUp,
                            null,
                            tint = if (isActive) AppColors.error else onSurfaceVar,
                            modifier = Modifier.size(12.dp))
                        Spacer(modifier = Modifier.width(3.dp))
                        Text(
                            when {
                                isActive -> "Stop"
                                isHost -> "Hear host"
                                else -> "Hear student"
                            },
                            color = if (isActive) AppColors.error else onSurfaceVar, fontSize = 10.sp)
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
                    fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${session.subject.ifBlank { "General" }} · ${session.script.size} turns",
                    color = onSurfaceVar, fontSize = 11.sp)
            }
            Icon(Icons.Default.PlayCircleOutline, null, tint = primary, modifier = Modifier.size(22.dp))
        }
    }
}

/**
 * One speakable slice of an episode. TTS queues these individually so a pause can
 * resume at the current sentence instead of restarting the whole turn.
 */
private data class Utterance(
    val text: String,
    val segIdx: Int,
    val speaker: String
)

/**
 * Breaks a turn into natural TTS-sized pieces at sentence boundaries, then
 * trims any leftover clause that is still too long to pause between comfortably.
 */
private fun splitForSpeech(raw: String, maxLen: Int = 260): List<String> {
    if (raw.isBlank()) return emptyList()
    val pieces = mutableListOf<String>()
    // Split after . ! ? while keeping the terminator with its sentence.
    for (sentence in raw.split(Regex("(?<=[.!?])\\s+"))) {
        val trimmed = sentence.trim()
        if (trimmed.isEmpty()) continue
        if (trimmed.length <= maxLen) {
            pieces.add(trimmed)
        } else {
            // Very long run-on sentence: fall back to clause breaks, then hard wrap.
            var buffer = StringBuilder()
            for (clause in trimmed.split(Regex("(?<=[,;:])\\s+"))) {
                val c = clause.trim()
                if (c.isEmpty()) continue
                if (buffer.isNotEmpty() && buffer.length + c.length + 1 > maxLen) {
                    pieces.add(buffer.toString())
                    buffer = StringBuilder()
                }
                if (buffer.isNotEmpty()) buffer.append(' ')
                buffer.append(c)
            }
            if (buffer.isNotEmpty()) pieces.add(buffer.toString())
        }
    }
    return pieces
}
