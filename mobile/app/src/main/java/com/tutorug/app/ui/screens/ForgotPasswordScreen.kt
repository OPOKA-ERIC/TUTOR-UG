package com.tutorug.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.tutorug.app.ui.components.AuthBackdrop
import com.tutorug.app.ui.components.AuthTextField
import com.tutorug.app.ui.components.GoldButton
import com.tutorug.app.ui.theme.*

@Composable
fun ForgotPasswordScreen(
    onBackClick: () -> Unit,
    onOtpSent: (String) -> Unit,
    onSendOtp: (String, (Boolean, String) -> Unit) -> Unit
) {
    var email     by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg  by remember { mutableStateOf<String?>(null) }

    AuthBackdrop {

        // Toast
        Column(modifier = Modifier.statusBarsPadding().zIndex(10f)) {
            TutorUGToast(
                message = errorMsg,
                type = ToastType.ERROR,
                onDismiss = { errorMsg = null }
            )
        }

        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {

            // ── Header: circular back + logo + title, blended into the backdrop ──
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier.size(48.dp).noRippleClickable { onBackClick() },
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier.size(36.dp).background(AppColors.surfaceInput.copy(alpha = 0.6f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.ArrowBack, null, tint = Amber400, modifier = Modifier.size(18.dp))
                    }
                }
                Spacer(modifier = Modifier.width(4.dp))
                AppLogo()
                Spacer(modifier = Modifier.width(10.dp))
                Text("Reset Password", fontFamily = Baloo, fontSize = 20.sp,
                    fontWeight = FontWeight.Black, color = AppColors.textPrimary)
            }

            Column(
                modifier = Modifier.fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .imePadding().navigationBarsPadding().padding(horizontal = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(24.dp))

                // ── Icon badge: gold gradient circle with a pulsing glow ───────
                Box(contentAlignment = Alignment.Center) {
                    Box(
                        modifier = Modifier.size(150.dp)
                            .background(Brush.radialGradient(listOf(Amber500.copy(alpha = 0.30f), Color.Transparent)), CircleShape)
                    )
                    Box(
                        modifier = Modifier.size(96.dp)
                            .shadow(10.dp, CircleShape, clip = false)
                            .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape)
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize().background(
                                Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.30f), Color.Transparent)),
                                CircleShape
                            )
                        )
                        Icon(
                            Icons.Default.Lock, null, tint = Color(0xFF1A1000),
                            modifier = Modifier.size(40.dp).align(Alignment.Center)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // ── Display typography ─────────────────────────────────────────
                Text("Forgot your password?",
                    fontFamily = Baloo, fontSize = 28.sp, fontWeight = FontWeight.Black,
                    color = AppColors.textPrimary, textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Enter the email address linked to your account and we'll send you a 6-digit reset code.",
                    fontSize = 14.sp, color = AppColors.onSurfaceVar, lineHeight = 20.sp, textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(28.dp))

                // ── Gold-bordered input ────────────────────────────────────────
                AuthTextField(
                    value = email,
                    onValueChange = { email = it; errorMsg = null },
                    label = "Email Address",
                    placeholder = "your@email.com",
                    leadingIcon = { Icon(Icons.Default.Email, null, tint = Amber400, modifier = Modifier.size(20.dp)) }
                )

                Spacer(modifier = Modifier.height(18.dp))

                // ── Primary CTA: gold ──────────────────────────────────────────
                GoldButton(
                    label = "Send Reset Code",
                    onClick = {
                        isLoading = true
                        errorMsg = null
                        onSendOtp(email.trim()) { success, msg ->
                            isLoading = false
                            if (success) onOtpSent(email.trim())
                            else errorMsg = msg
                        }
                    },
                    enabled = email.isNotBlank() && !isLoading,
                    loading = isLoading
                )

                Spacer(modifier = Modifier.height(36.dp))

                // ── Footer anchor: kitenge dots + tagline ──────────────────────
                Row(verticalAlignment = Alignment.CenterVertically) {
                    repeat(3) { i ->
                        Box(
                            Modifier.size(if (i == 1) 5.dp else 3.dp)
                                .background(if (i == 1) Amber400 else AppColors.outline.copy(alpha = 0.35f), CircleShape)
                        )
                        if (i < 2) Spacer(modifier = Modifier.width(6.dp))
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))
                Text("🇺🇬  Empowering Ugandan Students", fontFamily = Baloo, fontWeight = FontWeight.Medium,
                    fontSize = 13.sp, color = AppColors.onSurfaceVar, textAlign = TextAlign.Center)

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}