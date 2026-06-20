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
import com.tutorug.app.data.model.RoomMessage
import com.tutorug.app.data.model.StudyRoom
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.theme.*
import com.tutorug.app.viewmodel.StudyRoomViewModel

@Composable
fun StudyRoomsScreen(
    userProfile: UserProfile,
    viewModel: StudyRoomViewModel,
    onBackClick: () -> Unit
) {
    val rooms by viewModel.rooms.collectAsState()
    val messages by viewModel.messages.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val sending by viewModel.sending.collectAsState()
    val blocked by viewModel.messageBlocked.collectAsState()

    val primary = AppColors.primary
    val surface = AppColors.surface
    val surfaceVar = AppColors.surfaceVar
    val onSurfaceVar = AppColors.onSurfaceVar
    val error = AppColors.error

    var activeRoom by remember { mutableStateOf<StudyRoom?>(null) }
    var input by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(Unit) { viewModel.loadRooms() }
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
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
            IconButton(
                onClick = {
                    if (activeRoom != null) { activeRoom = null; viewModel.clearMessages() }
                    else onBackClick()
                },
                modifier = Modifier.size(48.dp)
            ) {
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
            Column(modifier = Modifier.weight(1f)) {
                Text(activeRoom?.subject ?: "Study Rooms", color = AppColors.textPrimary,
                    fontWeight = FontWeight.Bold, fontSize = 17.sp)
                if (activeRoom != null)
                    Text("${activeRoom!!.educationLevel.ifBlank { "All levels" }} · Academic chat",
                        color = onSurfaceVar, fontSize = 11.sp)
            }
        }

        if (activeRoom == null) {
            // Room list
            if (loading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = primary, modifier = Modifier.size(32.dp))
                }
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    item {
                        Text("ACADEMIC DISCUSSION ROOMS", color = onSurfaceVar,
                            fontSize = 10.sp, fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 4.dp))
                        Text("All messages are moderated — academic topics only.",
                            color = onSurfaceVar, fontSize = 11.sp, modifier = Modifier.padding(bottom = 4.dp))
                    }
                    items(rooms) { room ->
                        Surface(
                            shape = RoundedCornerShape(14.dp), color = surface,
                            modifier = Modifier.fillMaxWidth()
                                .border(1.dp, primary.copy(0.12f), RoundedCornerShape(14.dp))
                                .clickable {
                                    activeRoom = room
                                    viewModel.loadMessages(room.roomId)
                                }
                        ) {
                            Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(room.subject, color = AppColors.textPrimary,
                                        fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    if (room.educationLevel.isNotBlank())
                                        Text(room.educationLevel, color = primary, fontSize = 11.sp)
                                    if (room.description.isNotBlank())
                                        Text(room.description, color = onSurfaceVar, fontSize = 11.sp)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Group, null, tint = onSurfaceVar, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text("${room.memberCount}", color = onSurfaceVar, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            }
        } else {
            // Chat view
            val room = activeRoom!!

            Column(modifier = Modifier.fillMaxSize()) {
                LazyColumn(modifier = Modifier.weight(1f).padding(horizontal = 16.dp, vertical = 8.dp),
                    state = listState, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (messages.isEmpty() && !loading) {
                        item {
                            Column(modifier = Modifier.fillMaxWidth().padding(top = 48.dp),
                                horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.Forum, null, tint = onSurfaceVar, modifier = Modifier.size(44.dp))
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("Start the discussion!", color = AppColors.textPrimary, fontWeight = FontWeight.Bold)
                                Text("Only academic messages are allowed.", color = onSurfaceVar, fontSize = 12.sp)
                            }
                        }
                    }
                    items(messages) { msg ->
                        RoomMessageBubble(msg = msg, myUserId = userProfile.userId,
                            primary = primary, surface = surface, onSurfaceVar = onSurfaceVar)
                    }
                }

                if (blocked) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)
                            .background(error.copy(0.12f), RoundedCornerShape(10.dp))
                            .border(1.dp, error.copy(0.3f), RoundedCornerShape(10.dp))
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Shield, null, tint = error, modifier = Modifier.size(15.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Message blocked — academic topics only.", color = error, fontSize = 12.sp)
                    }
                }

                // Input bar
                Box(modifier = Modifier.fillMaxWidth().navigationBarsPadding().imePadding()
                    .padding(horizontal = 16.dp, vertical = 10.dp)) {
                    Box(
                        modifier = Modifier.fillMaxWidth()
                            .background(Brush.linearGradient(listOf(surfaceVar, surface)), RoundedCornerShape(28.dp))
                            .border(1.5.dp,
                                Brush.linearGradient(listOf(primary.copy(0.6f), Violet400.copy(0.4f))),
                                RoundedCornerShape(28.dp))
                    ) {
                        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            BasicTextField(
                                value = input,
                                onValueChange = { input = it },
                                modifier = Modifier.weight(1f),
                                textStyle = TextStyle(color = AppColors.textPrimary, fontSize = 14.sp),
                                cursorBrush = Brush.linearGradient(listOf(primary, Violet400)),
                                maxLines = 4,
                                decorationBox = { inner ->
                                    if (input.isEmpty()) Text("Ask an academic question…",
                                        color = AppColors.textDisabled, fontSize = 14.sp)
                                    inner()
                                }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            IconButton(
                                onClick = {
                                    if (input.isNotBlank() && !sending) {
                                        viewModel.sendMessage(room.roomId, userProfile.userId, userProfile.name,
                                            userProfile.avatarUrl, input.trim(), room.subject)
                                        input = ""
                                    }
                                },
                                enabled = input.isNotBlank() && !sending,
                                modifier = Modifier.size(38.dp)
                                    .background(
                                        if (input.isNotBlank()) Brush.linearGradient(listOf(Violet500, Violet600))
                                        else Brush.linearGradient(listOf(surfaceVar, surfaceVar)),
                                        CircleShape
                                    )
                            ) {
                                if (sending) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                else Icon(Icons.Default.Send, null, tint = AppColors.textPrimary, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RoomMessageBubble(
    msg: RoomMessage, myUserId: String,
    primary: Color, surface: Color, onSurfaceVar: Color
) {
    val isMe = msg.userId == myUserId
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isMe) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Bottom
    ) {
        if (!isMe) {
            Box(modifier = Modifier.size(30.dp)
                .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape),
                contentAlignment = Alignment.Center) {
                Text(msg.userName.firstOrNull()?.uppercase() ?: "?",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1A1A1A))
            }
            Spacer(modifier = Modifier.width(6.dp))
        }
        Column(modifier = Modifier.widthIn(max = 260.dp)) {
            if (!isMe) Text(msg.userName, color = primary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 2.dp, start = 2.dp))
            Box(modifier = Modifier
                .background(
                    if (isMe) Brush.linearGradient(listOf(Amber500.copy(0.8f), Amber600))
                    else Brush.linearGradient(listOf(surface, AppColors.surfaceVar)),
                    if (isMe) RoundedCornerShape(18.dp, 4.dp, 18.dp, 18.dp)
                    else RoundedCornerShape(4.dp, 18.dp, 18.dp, 18.dp)
                )
                .border(1.dp,
                    if (isMe) Amber500.copy(0f) else primary.copy(0.2f),
                    if (isMe) RoundedCornerShape(18.dp, 4.dp, 18.dp, 18.dp)
                    else RoundedCornerShape(4.dp, 18.dp, 18.dp, 18.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp)) {
                Text(msg.content, fontSize = 14.sp,
                    color = if (isMe) Color(0xFF1A1A1A) else AppColors.textPrimary, lineHeight = 20.sp)
            }
        }
        if (isMe) {
            Spacer(modifier = Modifier.width(6.dp))
            Box(modifier = Modifier.size(30.dp)
                .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape),
                contentAlignment = Alignment.Center) {
                Text("Me", fontSize = 9.sp, fontWeight = FontWeight.Black, color = Color(0xFF1A1A1A))
            }
        }
    }
}

// Shared simple text input used by meetings form
@Composable
fun BasicTextInput(value: String, onValue: (String) -> Unit, placeholder: String) {
    Box(modifier = Modifier.fillMaxWidth()
        .background(AppColors.surfaceInput, RoundedCornerShape(10.dp))
        .border(1.dp, AppColors.outline, RoundedCornerShape(10.dp))
        .padding(horizontal = 12.dp, vertical = 11.dp)) {
        if (value.isEmpty()) Text(placeholder, color = AppColors.textDisabled, fontSize = 13.sp)
        BasicTextField(
            value = value, onValueChange = onValue,
            textStyle = TextStyle(color = AppColors.textPrimary, fontSize = 13.sp),
            modifier = Modifier.fillMaxWidth(),
            cursorBrush = Brush.linearGradient(listOf(AppColors.primary, Violet400))
        )
    }
}
