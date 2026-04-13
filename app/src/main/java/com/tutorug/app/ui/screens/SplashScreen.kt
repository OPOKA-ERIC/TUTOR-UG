package com.tutorug.app.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tutorug.app.R
import com.tutorug.app.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(onNavigateToAuth: () -> Unit = {}) {

    var started by remember { mutableStateOf(false) }

    val alpha by animateFloatAsState(
        targetValue = if (started) 1f else 0f,
        animationSpec = tween(1200, easing = EaseInOut), label = "alpha"
    )
    val scale by animateFloatAsState(
        targetValue = if (started) 1f else 0.75f,
        animationSpec = tween(1200, easing = EaseOutBack), label = "scale"
    )
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f, targetValue = 1.08f,
        animationSpec = infiniteRepeatable(tween(1000), RepeatMode.Reverse), label = "pulse"
    )
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.25f, targetValue = 0.6f,
        animationSpec = infiniteRepeatable(tween(1600), RepeatMode.Reverse), label = "glow"
    )

    LaunchedEffect(Unit) { started = true; delay(3000); onNavigateToAuth() }

    val bg = AppColors.background
    val surface = AppColors.surface
    val primary = AppColors.primary
    val tertiary = AppColors.tertiary
    val secondary = AppColors.secondary

    Box(
        modifier = Modifier.fillMaxSize()
            .background(Brush.verticalGradient(listOf(surface, bg))),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier.size(360.dp).offset(x = (-100).dp, y = (-140).dp)
                .background(Brush.radialGradient(listOf(primary.copy(alpha = glowAlpha * 0.18f), Color.Transparent)), CircleShape)
        )
        Box(
            modifier = Modifier.size(280.dp).offset(x = 120.dp, y = 160.dp)
                .background(Brush.radialGradient(listOf(tertiary.copy(alpha = glowAlpha * 0.14f), Color.Transparent)), CircleShape)
        )
        Box(
            modifier = Modifier.size(200.dp).offset(x = (-60).dp, y = 200.dp)
                .background(Brush.radialGradient(listOf(secondary.copy(alpha = glowAlpha * 0.1f), Color.Transparent)), CircleShape)
        )

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.alpha(alpha).scale(scale).padding(32.dp)
        ) {
            Box(
                modifier = Modifier.size(130.dp).scale(pulseScale)
                    .background(Brush.radialGradient(listOf(primary.copy(alpha = 0.35f), Color.Transparent)), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ic_tutorug_logo),
                    contentDescription = "TutorUG Logo",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.size(90.dp).clip(RoundedCornerShape(26.dp))
                )
            }

            Spacer(modifier = Modifier.height(36.dp))
            Text("TutorUG", fontSize = 46.sp, fontWeight = FontWeight.Black, color = AppColors.textPrimary)
            Spacer(modifier = Modifier.height(8.dp))
            Text("Uganda's Smart Learning Companion", fontSize = 15.sp, color = AppColors.onSurfaceVar, textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(40.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf(bg, primary, AppColors.error, bg, primary, AppColors.error).forEach { color ->
                    Box(modifier = Modifier.size(30.dp, 7.dp).background(color, RoundedCornerShape(4.dp)))
                }
            }

            Spacer(modifier = Modifier.height(48.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                listOf(primary, tertiary, secondary).forEachIndexed { i, color ->
                    val dotAlpha by infiniteTransition.animateFloat(
                        initialValue = 0.2f, targetValue = 1f,
                        animationSpec = infiniteRepeatable(tween(600, delayMillis = i * 200), RepeatMode.Reverse),
                        label = "dot$i"
                    )
                    Box(modifier = Modifier.size(9.dp).alpha(dotAlpha).background(color, CircleShape))
                }
            }
        }
    }
}
