package com.tutorug.app.ui.screens

import android.annotation.SuppressLint
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.tutorug.app.data.model.Meeting
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.theme.*
import com.tutorug.app.viewmodel.MeetingState
import com.tutorug.app.viewmodel.MeetingViewModel

@Composable
fun MeetingsScreen(
    userProfile: UserProfile,
    viewModel: MeetingViewModel,
    onBackClick: () -> Unit
) {
    val meetings by viewModel.meetings.collectAsState()
    val state by viewModel.state.collectAsState()
    val activeMeeting by viewModel.activeMeeting.collectAsState()

    val primary = AppColors.primary
    val surface = AppColors.surface
    val surfaceVar = AppColors.surfaceVar
    val onSurfaceVar = AppColors.onSurfaceVar
    val error = AppColors.error

    LaunchedEffect(Unit) { viewModel.load() }

    // ── ACTIVE MEETING (WebView with Daily.co) ────────────────────────────────
    if (activeMeeting != null) {
        val (roomUrl, token) = activeMeeting!!
        Column(modifier = Modifier.fillMaxSize().background(AppColors.background).statusBarsPadding()) {
            Row(
                modifier = Modifier.fillMaxWidth()
                    .background(Brush.horizontalGradient(listOf(AppColors.barStart, AppColors.barEnd)))
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(modifier = Modifier.size(8.dp).background(error, CircleShape))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Meeting in progress", color = AppColors.textPrimary, fontWeight = FontWeight.Bold,
                    fontSize = 14.sp, modifier = Modifier.weight(1f))
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = error.copy(alpha = 0.15f),
                    modifier = Modifier.clickable { viewModel.leaveMeeting() }
                ) {
                    Text("Leave", color = error, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp))
                }
            }
            DailyCoWebView(roomUrl = roomUrl, token = token, modifier = Modifier.fillMaxSize())
        }
        return
    }

    var showCreate by remember { mutableStateOf(false) }
    var title by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var scheduledAt by remember { mutableStateOf("") }
    var durationMins by remember { mutableStateOf(60) }

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
            IconButton(onClick = onBackClick, modifier = Modifier.size(48.dp)) {
                Box(modifier = Modifier.size(36.dp).background(AppColors.surfaceInput, CircleShape),
                    contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.ArrowBack, null, tint = AppColors.textPrimary, modifier = Modifier.size(18.dp))
                }
            }
            Box(modifier = Modifier.size(34.dp)
                .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape),
                contentAlignment = Alignment.Center) {
                Text("T", fontSize = 13.sp, fontWeight = FontWeight.Black, color = AppColors.onPrimary)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text("Meetings", color = AppColors.textPrimary, fontWeight = FontWeight.Bold,
                fontSize = 18.sp, modifier = Modifier.weight(1f))
            IconButton(onClick = { showCreate = !showCreate }, modifier = Modifier.size(46.dp)) {
                Box(modifier = Modifier.size(38.dp)
                    .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape),
                    contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Add, null, tint = AppColors.onPrimary, modifier = Modifier.size(22.dp))
                }
            }
        }

        LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {

            // Create form
            if (showCreate) {
                item {
                    Surface(shape = RoundedCornerShape(16.dp), color = surface,
                        modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Schedule a Meeting", color = AppColors.textPrimary,
                                    fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                                IconButton(onClick = { showCreate = false }, modifier = Modifier.size(28.dp)) {
                                    Icon(Icons.Default.Close, null, tint = onSurfaceVar, modifier = Modifier.size(16.dp))
                                }
                            }
                            MeetingInput(value = title, onValue = { title = it }, placeholder = "Meeting title *")
                            MeetingInput(value = subject, onValue = { subject = it }, placeholder = "Subject (e.g. Mathematics)")
                            MeetingInput(value = description, onValue = { description = it }, placeholder = "Description (optional)")
                            MeetingInput(value = scheduledAt, onValue = { scheduledAt = it }, placeholder = "Date & Time (YYYY-MM-DDTHH:MM) *")
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                listOf(30, 60, 90, 120).forEach { mins ->
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = if (durationMins == mins) primary.copy(0.2f) else surfaceVar,
                                        modifier = Modifier.clickable { durationMins = mins }
                                    ) {
                                        Text("${mins}m", fontSize = 11.sp, fontWeight = FontWeight.Bold,
                                            color = if (durationMins == mins) primary else onSurfaceVar,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
                                    }
                                }
                            }
                            val creating = state is MeetingState.Loading
                            Button(
                                onClick = {
                                    if (title.isBlank() || scheduledAt.isBlank()) return@Button
                                    viewModel.create(userProfile.userId, title, subject, description, scheduledAt, durationMins) {
                                        showCreate = false; title = ""; subject = ""; description = ""; scheduledAt = ""
                                    }
                                },
                                enabled = title.isNotBlank() && scheduledAt.isNotBlank() && !creating,
                                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                                contentPadding = PaddingValues(0.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Box(modifier = Modifier.fillMaxWidth().height(44.dp)
                                    .background(Brush.linearGradient(listOf(Amber400, Amber600)), RoundedCornerShape(12.dp)),
                                    contentAlignment = Alignment.Center) {
                                    if (creating) CircularProgressIndicator(color = AppColors.onPrimary, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                                    else Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.VideoCall, null, tint = AppColors.onPrimary, modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("Create Meeting", color = AppColors.onPrimary, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (meetings.isEmpty() && state !is MeetingState.Loading) {
                item {
                    Column(modifier = Modifier.fillMaxWidth().padding(top = 60.dp),
                        horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.VideoCall, null, tint = onSurfaceVar, modifier = Modifier.size(52.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("No upcoming meetings", color = AppColors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                        Text("Tap + to schedule a meeting", color = onSurfaceVar, fontSize = 13.sp)
                    }
                }
            }

            items(meetings) { m ->
                MeetingCard(meeting = m, userId = userProfile.userId, primary = primary,
                    surface = surface, error = error, onSurfaceVar = onSurfaceVar,
                    onJoin = { viewModel.join(m, userProfile.userId) })
            }
        }
    }
}

@Composable
private fun MeetingCard(
    meeting: Meeting, userId: String, primary: Color, surface: Color,
    error: Color, onSurfaceVar: Color, onJoin: () -> Unit
) {
    val isHost = meeting.hostId == userId
    val isLive = meeting.status == "live"
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = surface,
        modifier = Modifier.fillMaxWidth()
            .border(1.dp,
                if (isLive) error.copy(0.4f) else primary.copy(0.15f),
                RoundedCornerShape(16.dp))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            if (isLive) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 6.dp)) {
                    val inf = rememberInfiniteTransition(label = "pulse")
                    val alpha by inf.animateFloat(0.4f, 1f, infiniteRepeatable(tween(600), RepeatMode.Reverse), label = "pulse")
                    Box(modifier = Modifier.size(8.dp).alpha(alpha).background(error, CircleShape))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("LIVE NOW", color = error, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
            Text(meeting.title, color = AppColors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            if (meeting.subject.isNotBlank()) Text(meeting.subject, color = primary, fontSize = 12.sp)
            if (meeting.description.isNotBlank()) Text(meeting.description, color = onSurfaceVar, fontSize = 12.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CalendarMonth, null, tint = onSurfaceVar, modifier = Modifier.size(13.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(meeting.scheduledAt.take(10), color = onSurfaceVar, fontSize = 11.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Schedule, null, tint = onSurfaceVar, modifier = Modifier.size(13.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("${meeting.durationMins} min", color = onSurfaceVar, fontSize = 11.sp)
                }
                if (isHost) Surface(shape = RoundedCornerShape(20.dp), color = primary.copy(0.15f)) {
                    Text("Host", color = primary, fontSize = 10.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
            Button(
                onClick = onJoin,
                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                contentPadding = PaddingValues(0.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(modifier = Modifier.fillMaxWidth().height(40.dp)
                    .background(
                        if (isLive) Brush.linearGradient(listOf(Color(0xFFEF4444), Color(0xFFDC2626)))
                        else Brush.linearGradient(listOf(Amber400, Amber600)),
                        RoundedCornerShape(10.dp)),
                    contentAlignment = Alignment.Center) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.VideoCall, null,
                            tint = if (isLive) Color.White else AppColors.onPrimary,
                            modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (isLive) "Join Now" else "Join Meeting",
                            color = if (isLive) Color.White else AppColors.onPrimary,
                            fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun MeetingInput(value: String, onValue: (String) -> Unit, placeholder: String) {
    BasicTextInput(value = value, onValue = onValue, placeholder = placeholder)
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun DailyCoWebView(roomUrl: String, token: String, modifier: Modifier = Modifier) {
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            WebView(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                webViewClient = WebViewClient()
                settings.javaScriptEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.domStorageEnabled = true
                loadUrl("$roomUrl?t=$token")
            }
        }
    )
}
