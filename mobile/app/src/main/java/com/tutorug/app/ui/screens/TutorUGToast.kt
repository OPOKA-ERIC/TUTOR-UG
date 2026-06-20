package com.tutorug.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.tutorug.app.ui.theme.*
import kotlinx.coroutines.delay

enum class ToastType { ERROR, SUCCESS, INFO }

@Composable
fun TutorUGToast(
    message: String?,
    type: ToastType = ToastType.ERROR,
    onDismiss: () -> Unit
) {
    val visible = !message.isNullOrBlank()

    LaunchedEffect(message) {
        if (!message.isNullOrBlank()) {
            delay(4000)
            onDismiss()
        }
    }

    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(tween(300)) { -it } + fadeIn(tween(300)),
        exit  = slideOutVertically(tween(250)) { -it } + fadeOut(tween(250)),
        modifier = Modifier
            .fillMaxWidth()
            .zIndex(10f)
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        val (bgColor, iconColor, icon) = when (type) {
            ToastType.ERROR   -> Triple(Color(0xFF3A1A1A), Color(0xFFFF5252), Icons.Default.Warning)
            ToastType.SUCCESS -> Triple(Color(0xFF1A3A1A), Color(0xFF69F0AE), Icons.Default.CheckCircle)
            ToastType.INFO    -> Triple(Color(0xFF1A2A3A), Amber400,          Icons.Default.Info)
        }

        Surface(
            shape = RoundedCornerShape(14.dp),
            color = bgColor,
            shadowElevation = 8.dp,
            tonalElevation = 4.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(icon, null, tint = iconColor, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = message ?: "",
                    color = TextWhite,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f),
                    lineHeight = 18.sp
                )
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(onClick = onDismiss, modifier = Modifier.size(20.dp)) {
                    Icon(Icons.Default.Close, null, tint = TextMuted, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}
