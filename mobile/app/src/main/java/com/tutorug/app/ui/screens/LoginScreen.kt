package com.tutorug.app.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.tutorug.app.R
import com.tutorug.app.ui.components.AuthBackdrop
import com.tutorug.app.ui.components.AuthTextField
import com.tutorug.app.ui.components.GoldButton
import com.tutorug.app.ui.theme.*
import com.tutorug.app.viewmodel.AuthState
import com.tutorug.app.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onLoginSuccess: () -> Unit,
    onRegisterClick: () -> Unit,
    onForgotPasswordClick: () -> Unit = {}
) {
    val authState by viewModel.authState.collectAsState()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    LaunchedEffect(authState) { if (authState is AuthState.Authenticated) onLoginSuccess() }

    // Clear error when leaving this screen
    DisposableEffect(Unit) { onDispose { viewModel.clearError() } }

    val surface = AppColors.surface
    val primary = AppColors.primary
    val tertiary  = AppColors.tertiary
    val outline   = AppColors.outline

    // ── Motion cues: gentle logo entrance (scale + fade) ──────────────────────
    val logoProgress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        logoProgress.animateTo(1f, tween(700, easing = FastOutSlowInEasing))
    }
    // Soft glow pulse behind the logo
    val pulse = rememberInfiniteTransition(label = "logoPulse")
    val pulseAlpha by pulse.animateFloat(
        initialValue = 0.10f, targetValue = 0.30f,
        animationSpec = infiniteRepeatable(tween(2200), RepeatMode.Reverse),
        label = "pulseAlpha"
    )

    AuthBackdrop {
        // Pulsing glow right behind the logo
        Box(
            modifier = Modifier.align(Alignment.TopCenter).size(440.dp).offset(y = (-90).dp)
                .graphicsLayer { alpha = pulseAlpha }
                .background(
                    Brush.radialGradient(listOf(Amber500.copy(alpha = 0.35f), Color.Transparent)),
                    CircleShape
                )
        )
        // Corner depth glows
        Box(
            modifier = Modifier.size(300.dp).offset(x = (-70).dp, y = (-70).dp)
                .background(Brush.radialGradient(listOf(primary.copy(alpha = 0.14f), Color.Transparent)), CircleShape)
        )
        Box(
            modifier = Modifier.size(220.dp).align(Alignment.BottomEnd).offset(x = 60.dp, y = 60.dp)
                .background(Brush.radialGradient(listOf(tertiary.copy(alpha = 0.12f), Color.Transparent)), CircleShape)
        )

        // Toast
        Column(modifier = Modifier.statusBarsPadding().zIndex(10f)) {
            TutorUGToast(
                message = if (authState is AuthState.Error) (authState as AuthState.Error).message else null,
                type = ToastType.ERROR,
                onDismiss = { viewModel.clearError() }
            )
        }

        Column(
            modifier = Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()
                .verticalScroll(rememberScrollState()).padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // ── Logo (entrance animation + pulse glow) ─────────────────────────
            Box(modifier = Modifier.padding(top = 24.dp), contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier.size(140.dp).graphicsLayer { alpha = pulseAlpha }
                        .background(
                            Brush.radialGradient(listOf(Amber500.copy(alpha = 0.45f), Color.Transparent)),
                            CircleShape
                        )
                )
                Box(
                    modifier = Modifier.size(88.dp).graphicsLayer {
                            scaleX = 0.84f + 0.16f * logoProgress.value
                            scaleY = 0.84f + 0.16f * logoProgress.value
                            alpha = logoProgress.value
                        }
                        .background(Brush.linearGradient(listOf(Amber400, Amber600)), RoundedCornerShape(24.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.ic_tutorug_logo),
                        contentDescription = "TutorUG Logo",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp))
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            // ── Typography with rhythm: rounded display font, varied weight/size ──
            Text(
                buildAnnotatedString {
                    withStyle(
                        SpanStyle(
                            fontFamily = Baloo,
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = (-0.5).sp,
                            color = AppColors.textPrimary
                        )
                    ) { append("Welcome Back!") }
                    withStyle(SpanStyle(fontSize = 24.sp, fontWeight = FontWeight.Normal)) { append("  👋") }
                },
                textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp)
            )
            Text(
                "Sign in to continue learning",
                fontFamily = Baloo, fontSize = 14.sp, fontWeight = FontWeight.Medium,
                color = AppColors.onSurfaceVar, modifier = Modifier.padding(top = 5.dp)
            )
            Spacer(modifier = Modifier.height(24.dp))

            Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = surface) {
                Column(modifier = Modifier.padding(20.dp)) {

                    Text("Email", fontSize = 13.sp, color = AppColors.onSurfaceVar, fontWeight = FontWeight.Medium)
                    Spacer(modifier = Modifier.height(6.dp))
                    AuthTextField(
                        value = email,
                        onValueChange = { email = it },
                        placeholder = "your@email.com",
                        leadingIcon = { Icon(Icons.Default.Email, null, tint = Amber400, modifier = Modifier.size(20.dp)) }
                    )

                    Spacer(modifier = Modifier.height(14.dp))
                    Text("Password", fontSize = 13.sp, color = AppColors.onSurfaceVar, fontWeight = FontWeight.Medium)
                    Spacer(modifier = Modifier.height(6.dp))
                    AuthTextField(
                        value = password,
                        onValueChange = { password = it },
                        placeholder = "••••••••",
                        password = true,
                        leadingIcon = { Icon(Icons.Default.Lock, null, tint = Amber400, modifier = Modifier.size(20.dp)) },
                        trailing = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    null, tint = Amber400, modifier = Modifier.size(20.dp))
                            }
                        }
                    )

                    Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.End) {
                        Text("Forgot Password?", color = Amber400, fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable { onForgotPasswordClick() })
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    val canLogin = authState !is AuthState.Loading && email.isNotBlank() && password.isNotBlank()
                    // Sign In is the visual anchor — always gold, dimmed until fields validate
                    GoldButton(
                        label = "Sign In",
                        onClick = { viewModel.login(email, password) },
                        enabled = canLogin,
                        loading = authState is AuthState.Loading
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                HorizontalDivider(modifier = Modifier.weight(1f), color = outline)
                Text("  or  ", color = AppColors.onSurfaceVar, fontSize = 13.sp)
                HorizontalDivider(modifier = Modifier.weight(1f), color = outline)
            }
            Spacer(modifier = Modifier.height(16.dp))

            val context = LocalContext.current
            Button(
                onClick = { viewModel.signInWithGoogle(context) },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                contentPadding = PaddingValues(0.dp),
                enabled = authState !is AuthState.Loading
            ) {
                Box(
                    modifier = Modifier.fillMaxSize()
                        .background(
                            Brush.verticalGradient(listOf(Color(0xFFFFFBF0), Color(0xFFF8F4E9))),
                            RoundedCornerShape(14.dp)
                        )
                        .border(1.5.dp, Color(0xFFE6DEC9), RoundedCornerShape(14.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        GoogleLogo(size = 18.dp)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text("Continue with Google", fontFamily = Baloo, fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold, color = Color(0xFF1F1F1F))
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedButton(
                onClick = onRegisterClick,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp),
                border = ButtonDefaults.outlinedButtonBorder.copy(
                    brush = Brush.linearGradient(listOf(primary.copy(alpha = 0.6f), tertiary.copy(alpha = 0.6f)))
                )
            ) {
                Text("Create New Account", fontFamily = Baloo, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Amber400)
            }

            Spacer(modifier = Modifier.height(24.dp))
            // Gold dot divider — subtle kitenge touch
            Row(verticalAlignment = Alignment.CenterVertically) {
                repeat(3) { i ->
                    Box(
                        Modifier.size(if (i == 1) 5.dp else 3.dp)
                            .background(if (i == 1) Amber400 else AppColors.outline.copy(alpha = 0.35f), CircleShape)
                    )
                    if (i < 2) Spacer(modifier = Modifier.width(6.dp))
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text("🇺🇬  Empowering Ugandan Students", fontFamily = Baloo, fontWeight = FontWeight.Medium,
                fontSize = 13.sp, color = AppColors.onSurfaceVar, textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(16.dp))
        }

        if (authState is AuthState.Loading) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.55f)), contentAlignment = Alignment.Center) {
                Surface(shape = RoundedCornerShape(20.dp), color = surface) {
                    Column(modifier = Modifier.padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = primary, strokeWidth = 3.dp)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Signing you in...", color = AppColors.textMuted, fontSize = 14.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun GoogleLogo(size: Dp) {
    Canvas(modifier = Modifier.size(size)) {
        val blue   = Color(0xFF4285F4)
        val red    = Color(0xFFEA4335)
        val yellow = Color(0xFFFBBC05)
        val green  = Color(0xFF34A853)

        val strokeW = size.toPx() * 0.18f
        val half = size.toPx() / 2f
        val r = half - strokeW
        val arcSize = androidx.compose.ui.geometry.Size(r * 2, r * 2)

        drawArc(blue, startAngle = 270f, sweepAngle = 90f, useCenter = false,
            style = Stroke(width = strokeW), topLeft = Offset(half - r, half - r), size = arcSize)
        drawArc(red, startAngle = 0f, sweepAngle = 90f, useCenter = false,
            style = Stroke(width = strokeW), topLeft = Offset(half - r, half - r), size = arcSize)
        drawArc(yellow, startAngle = 90f, sweepAngle = 90f, useCenter = false,
            style = Stroke(width = strokeW), topLeft = Offset(half - r, half - r), size = arcSize)
        drawArc(green, startAngle = 180f, sweepAngle = 90f, useCenter = false,
            style = Stroke(width = strokeW), topLeft = Offset(half - r, half - r), size = arcSize)
    }
}