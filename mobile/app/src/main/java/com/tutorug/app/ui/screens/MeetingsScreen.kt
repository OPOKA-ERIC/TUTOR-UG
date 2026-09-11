package com.tutorug.app.ui.screens

import android.annotation.SuppressLint
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.*
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.tutorug.app.data.model.Meeting
import com.tutorug.app.data.model.MeetingInvite
import com.tutorug.app.data.model.MeetingParticipant
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.theme.*
import com.tutorug.app.viewmodel.MeetingState
import com.tutorug.app.viewmodel.MeetingViewModel
import java.util.Calendar

@Composable
fun MeetingsScreen(
    userProfile: UserProfile,
    viewModel: MeetingViewModel,
    onBackClick: () -> Unit
) {
    val meetings by viewModel.meetings.collectAsState()
    val invitedMeetings by viewModel.invitedMeetings.collectAsState()
    val state by viewModel.state.collectAsState()
    val activeMeeting by viewModel.activeMeeting.collectAsState()
    val participants by viewModel.participants.collectAsState()
    val invites by viewModel.invites.collectAsState()

    val primary = AppColors.primary
    val surface = AppColors.surface
    val surfaceVar = AppColors.surfaceVar
    val onSurfaceVar = AppColors.onSurfaceVar
    val error = AppColors.error

    LaunchedEffect(Unit) { viewModel.load(userProfile.userId) }

    // Show toast for success/error messages
    LaunchedEffect(state) {
        if (state is MeetingState.Success || state is MeetingState.Error) {
            kotlinx.coroutines.delay(2500)
            viewModel.dismissError()
        }
    }

    // ── ACTIVE MEETING (WebView) ─────────────────────────────────────────────
    if (activeMeeting != null) {
        val (roomUrl, token) = activeMeeting!!
        BackHandler { viewModel.leaveMeeting() }
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
            DailyCoWebView(roomUrl = roomUrl, token = token, userName = userProfile.name,
                modifier = Modifier.fillMaxSize())
        }
        return
    }

    var showCreate by remember { mutableStateOf(false) }
    var showInviteForm by remember { mutableStateOf<String?>(null) }
    var inviteEmails by remember { mutableStateOf("") }
    var showParticipantsFor by remember { mutableStateOf<String?>(null) }
    var showInvitesFor by remember { mutableStateOf<String?>(null) }

    // ── TOAST ──
    val toastMessage = when (state) {
        is MeetingState.Success -> (state as MeetingState.Success).message
        is MeetingState.Error -> (state as MeetingState.Error).message
        else -> null
    }
    if (toastMessage != null) {
        Box(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = if (state is MeetingState.Error) error.copy(0.15f) else primary.copy(0.15f),
                border = androidx.compose.foundation.BorderStroke(1.dp,
                    if (state is MeetingState.Error) error.copy(0.3f) else primary.copy(0.3f))
            ) {
                Text(toastMessage, color = AppColors.textPrimary, fontSize = 12.sp,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp))
            }
        }
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
                    CreateMeetingForm(
                        primary = primary, surface = surface, surfaceVar = surfaceVar, onSurfaceVar = onSurfaceVar,
                        onCreate = { title, subject, description, scheduledAt, durationMins ->
                            viewModel.create(userProfile.userId, title, subject, description,
                                scheduledAt, durationMins, userProfile.name) { showCreate = false }
                        },
                        onDismiss = { showCreate = false }
                    )
                }
            }

            // My Meetings
            if (meetings.isNotEmpty() || invitedMeetings.filter { it.hostId != userProfile.userId }.isNotEmpty()) {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.VideoCall, null, tint = primary, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("My Meetings", color = primary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            items(meetings) { m ->
                MeetingCard(meeting = m, userId = userProfile.userId, primary = primary,
                    surface = surface, surfaceVar = surfaceVar, error = error, onSurfaceVar = onSurfaceVar,
                    onJoin = { viewModel.join(m, userProfile.userId, userProfile.name) },
                    onDelete = { viewModel.deleteMeeting(m.meetingId) },
                    isPending = participants.any { it.meetingId == m.meetingId && it.userId == userProfile.userId && it.status == "pending" },
                    pendingParticipants = if (m.hostId == userProfile.userId) participants.filter { it.meetingId == m.meetingId && it.status == "pending" } else emptyList(),
                    participantNames = emptyMap(),
                    onApprove = { viewModel.approveParticipant(it.id) },
                    onRefuse = { viewModel.refuseParticipant(it.id) },
                    onShowParticipants = {
                        showParticipantsFor = if (showParticipantsFor == m.meetingId) null else m.meetingId
                        if (showParticipantsFor != null) viewModel.loadParticipants(m.meetingId)
                    },
                    showParticipants = showParticipantsFor == m.meetingId,
                    approvedParticipants = if (showParticipantsFor == m.meetingId) participants.filter { it.meetingId == m.meetingId && it.status != "refused" } else emptyList(),
                    onInvite = { showInviteForm = if (showInviteForm == m.meetingId) null else m.meetingId },
                    showInviteForm = showInviteForm == m.meetingId,
                    inviteEmails = inviteEmails,
                    onInviteEmailsChange = { inviteEmails = it },
                    onSendInvites = {
                        viewModel.sendInvites(m.meetingId, inviteEmails.split(",").map { it.trim() }.filter { it.isNotEmpty() }, userProfile.name)
                        inviteEmails = ""
                        showInviteForm = null
                    },
                    invites = if (showInvitesFor == m.meetingId) invites else emptyList(),
                    showInvites = showInvitesFor == m.meetingId,
                    onShowInvites = {
                        showInvitesFor = if (showInvitesFor == m.meetingId) null else m.meetingId
                        if (showInvitesFor != null) viewModel.loadInvites(m.meetingId)
                    }
                )
            }

            // Invited meetings from others
            val myInvited = invitedMeetings.filter { it.hostId != userProfile.userId }
            if (myInvited.isNotEmpty()) {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Mail, null, tint = Color(0xFF84CC16), modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Invited to (${myInvited.size})", color = Color(0xFF84CC16),
                            fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
                items(myInvited) { m ->
                    MeetingCard(meeting = m, userId = userProfile.userId, primary = primary,
                        surface = surface, surfaceVar = surfaceVar, error = error, onSurfaceVar = onSurfaceVar,
                        onJoin = { viewModel.join(m, userProfile.userId, userProfile.name) },
                        onDelete = { },
                        isPending = participants.any { it.meetingId == m.meetingId && it.userId == userProfile.userId && it.status == "pending" },
                        pendingParticipants = emptyList(),
                        participantNames = emptyMap(),
                        onApprove = { }, onRefuse = { },
                        onShowParticipants = { },
                        showParticipants = false,
                        approvedParticipants = emptyList(),
                        onInvite = { },
                        showInviteForm = false,
                        inviteEmails = "",
                        onInviteEmailsChange = { },
                        onSendInvites = { },
                        invites = emptyList(),
                        showInvites = false,
                        onShowInvites = { }
                    )
                }
            }

            if (meetings.isEmpty() && myInvited.isEmpty() && state !is MeetingState.Loading) {
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
        }
    }
}

@Composable
private fun CreateMeetingForm(
    primary: Color, surface: Color, surfaceVar: Color, onSurfaceVar: Color,
    onCreate: (title: String, subject: String, description: String, scheduledAt: String, durationMins: Int) -> Unit,
    onDismiss: () -> Unit
) {
    var title by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var scheduledAt by remember { mutableStateOf("") }
    var durationMins by remember { mutableStateOf(60) }
    val context = LocalContext.current

    Surface(shape = RoundedCornerShape(16.dp), color = surface,
        modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Schedule a Meeting", color = AppColors.textPrimary,
                    fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Close, null, tint = onSurfaceVar, modifier = Modifier.size(16.dp))
                }
            }
            MeetingInput(value = title, onValue = { title = it }, placeholder = "Meeting title *")
            MeetingInput(value = subject, onValue = { subject = it }, placeholder = "Subject (e.g. Mathematics)")
            MeetingInput(value = description, onValue = { description = it }, placeholder = "Description (optional)")

            // Calendar date picker
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = AppColors.surfaceInput,
                border = androidx.compose.foundation.BorderStroke(1.dp, AppColors.outline),
                modifier = Modifier.fillMaxWidth().clickable {
                    val cal = Calendar.getInstance()
                    DatePickerDialog(context, { _, year, month, day ->
                        TimePickerDialog(context, { _, hour, minute ->
                            scheduledAt = String.format("%04d-%02d-%02dT%02d:%02d", year, month + 1, day, hour, minute)
                        }, cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE), true).show()
                    }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
                }
            ) {
                Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    if (scheduledAt.isEmpty()) {
                        Text("Date & Time *", color = AppColors.textDisabled, fontSize = 13.sp,
                            modifier = Modifier.weight(1f))
                    } else {
                        Text(scheduledAt, color = AppColors.textPrimary, fontSize = 13.sp,
                            modifier = Modifier.weight(1f))
                    }
                    Icon(Icons.Default.CalendarMonth, null, tint = primary, modifier = Modifier.size(18.dp))
                }
            }

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
            Button(
                onClick = {
                    if (title.isBlank() || scheduledAt.isBlank()) return@Button
                    onCreate(title, subject, description, scheduledAt, durationMins)
                },
                enabled = title.isNotBlank() && scheduledAt.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                contentPadding = PaddingValues(0.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(modifier = Modifier.fillMaxWidth().height(44.dp)
                    .background(Brush.linearGradient(listOf(Amber400, Amber600)), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.VideoCall, null, tint = AppColors.onPrimary, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Create Meeting", color = AppColors.onPrimary, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun MeetingCard(
    meeting: Meeting, userId: String, primary: Color, surface: Color,
    surfaceVar: Color, error: Color, onSurfaceVar: Color,
    onJoin: () -> Unit, onDelete: () -> Unit,
    isPending: Boolean,
    pendingParticipants: List<MeetingParticipant>,
    participantNames: Map<String, String>,
    onApprove: (MeetingParticipant) -> Unit,
    onRefuse: (MeetingParticipant) -> Unit,
    onShowParticipants: () -> Unit,
    showParticipants: Boolean,
    approvedParticipants: List<MeetingParticipant>,
    onInvite: () -> Unit,
    showInviteForm: Boolean,
    inviteEmails: String,
    onInviteEmailsChange: (String) -> Unit,
    onSendInvites: () -> Unit,
    invites: List<MeetingInvite>,
    showInvites: Boolean,
    onShowInvites: () -> Unit
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
            // Header row: status + actions
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 4.dp)) {
                if (isLive) {
                    val inf = rememberInfiniteTransition(label = "pulse")
                    val alpha by inf.animateFloat(0.4f, 1f, infiniteRepeatable(tween(600), RepeatMode.Reverse), label = "pulse")
                    Box(modifier = Modifier.size(8.dp).alpha(alpha).background(error, CircleShape))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("LIVE NOW", color = error, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.weight(1f))
                if (isHost) {
                    IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Delete, null, tint = error, modifier = Modifier.size(16.dp))
                    }
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
                if (isPending) Surface(shape = RoundedCornerShape(20.dp), color = Color(0xFFFFB800).copy(0.15f)) {
                    Text("Pending", color = Color(0xFFFFB800), fontSize = 10.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                }
            }

            // Participants section (host only)
            if (isHost) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = surfaceVar,
                        modifier = Modifier.clickable { onShowParticipants() }
                    ) {
                        Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.People, null, tint = onSurfaceVar, modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Participants", color = onSurfaceVar, fontSize = 10.sp)
                            Icon(
                                if (showParticipants) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                null, tint = onSurfaceVar, modifier = Modifier.size(12.dp))
                        }
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = surfaceVar,
                        modifier = Modifier.clickable { onShowInvites() }
                    ) {
                        Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Mail, null, tint = onSurfaceVar, modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Invited", color = onSurfaceVar, fontSize = 10.sp)
                        }
                    }
                }

                // Pending participants
                if (pendingParticipants.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("Pending Approval", color = primary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    pendingParticipants.forEach { p ->
                        Row(verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(vertical = 2.dp)) {
                            Box(modifier = Modifier.size(20.dp).background(primary.copy(0.2f), CircleShape),
                                contentAlignment = Alignment.Center) {
                                Text((participantNames[p.userId] ?: "?").first().uppercase(),
                                    fontSize = 9.sp, color = primary, fontWeight = FontWeight.Bold)
                            }
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(participantNames[p.userId] ?: "User", color = AppColors.textPrimary,
                                fontSize = 11.sp, modifier = Modifier.weight(1f))
                            IconButton(onClick = { onApprove(p) }, modifier = Modifier.size(24.dp)) {
                                Icon(Icons.Default.Check, null, tint = Color(0xFF84CC16), modifier = Modifier.size(14.dp))
                            }
                            IconButton(onClick = { onRefuse(p) }, modifier = Modifier.size(24.dp)) {
                                Icon(Icons.Default.Close, null, tint = error, modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                }

                // Approved participants
                if (showParticipants && approvedParticipants.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("Participants", color = onSurfaceVar, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    approvedParticipants.forEach { p ->
                        Row(verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(vertical = 2.dp)) {
                            Box(modifier = Modifier.size(20.dp).background(primary.copy(0.2f), CircleShape),
                                contentAlignment = Alignment.Center) {
                                Text((participantNames[p.userId] ?: "?").first().uppercase(),
                                    fontSize = 9.sp, color = primary, fontWeight = FontWeight.Bold)
                            }
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(participantNames[p.userId] ?: "User", color = AppColors.textPrimary, fontSize = 11.sp)
                            if (p.userId == meeting.hostId) {
                                Surface(shape = RoundedCornerShape(10.dp), color = primary.copy(0.1f)) {
                                    Text("Host", fontSize = 8.sp, color = primary, fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp))
                                }
                            }
                        }
                    }
                }

                // Invite form
                if (showInviteForm) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("Invite by Email", color = onSurfaceVar, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        MeetingInput(value = inviteEmails, onValue = onInviteEmailsChange,
                            placeholder = "email1@, email2@")
                        Spacer(modifier = Modifier.width(6.dp))
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = primary,
                            modifier = Modifier.clickable { onSendInvites() }
                        ) {
                            Icon(Icons.Default.Send, null, tint = AppColors.onPrimary,
                                modifier = Modifier.padding(8.dp).size(14.dp))
                        }
                    }
                    Text("Separate with commas", color = onSurfaceVar, fontSize = 9.sp)
                }

                // Invited list
                if (showInvites && invites.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("Invited People", color = onSurfaceVar, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    invites.forEach { inv ->
                        Row(verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(vertical = 2.dp)) {
                            Icon(Icons.Default.Mail, null, tint = onSurfaceVar, modifier = Modifier.size(10.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(inv.email, color = AppColors.textPrimary, fontSize = 10.sp,
                                modifier = Modifier.weight(1f))
                            Surface(shape = RoundedCornerShape(10.dp), color = when (inv.status) {
                                "accepted" -> Color(0xFF84CC16).copy(0.15f)
                                "refused" -> error.copy(0.15f)
                                else -> primary.copy(0.15f)
                            }) {
                                Text(inv.status, fontSize = 8.sp, fontWeight = FontWeight.Bold,
                                    color = when (inv.status) {
                                        "accepted" -> Color(0xFF84CC16)
                                        "refused" -> error
                                        else -> primary
                                    },
                                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp))
                            }
                        }
                    }
                }
            }

            // Action buttons
            Spacer(modifier = Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (isHost) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = surfaceVar,
                        border = androidx.compose.foundation.BorderStroke(1.dp, primary.copy(0.2f)),
                        modifier = Modifier.weight(1f).height(40.dp).clickable { onInvite() }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.PersonAdd, null, tint = primary, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Invite", color = primary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                }
                Button(
                    onClick = onJoin,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = PaddingValues(0.dp),
                    modifier = Modifier.weight(if (isHost) 1.5f else 1f)
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
                            Text(
                                when {
                                    isLive -> "Join Now"
                                    isPending -> "Pending..."
                                    else -> "Join Meeting"
                                },
                                color = if (isLive) Color.White else AppColors.onPrimary,
                                fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
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
fun DailyCoWebView(roomUrl: String, token: String, userName: String = "",
    modifier: Modifier = Modifier) {
    val displayName = java.net.URLEncoder.encode(userName.ifBlank { "Participant" }, "UTF-8")
    // Jitsi URLs carry their config in the #fragment (never append ?query after it) —
    // appending "?t=..." after "#" corrupts the config and re-enables the prejoin/deep-link screens.
    val fullUrl = remember(roomUrl, token, displayName) {
        if (roomUrl.contains("#")) {
            if (roomUrl.contains("displayName")) roomUrl
            else roomUrl.replaceFirst("#", "#config.displayName=\"$displayName\"&")
        } else {
            val sep = if (roomUrl.contains("?")) "&" else "?"
            "$roomUrl${sep}t=$token&userName=$displayName"
        }
    }
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            WebView(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                webViewClient = WebViewClient()
                settings.javaScriptEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.domStorageEnabled = true
                settings.javaScriptCanOpenWindowsAutomatically = true
                loadUrl(fullUrl)
            }
        }
    )
}
