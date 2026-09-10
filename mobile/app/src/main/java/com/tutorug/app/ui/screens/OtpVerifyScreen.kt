package com.tutorug.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.tutorug.app.ui.components.AuthBackdrop
import com.tutorug.app.ui.components.GoldButton
import com.tutorug.app.ui.theme.*

@Composable
fun OtpVerifyScreen(
    email: String,
    onBackClick: () -> Unit,
    onVerified: () -> Unit,
    onResendOtp: (String, (Boolean, String) -> Unit) -> Unit,
    onVerifyOtp: (String, String, (Boolean, String) -> Unit) -> Unit
) {
    var otp         by remember { mutableStateOf("") }
    var isLoading   by remember { mutableStateOf(false) }
    var isResending by remember { mutableStateOf(false) }
    var errorMsg    by remember { mutableStateOf<String?>(null) }
    var resendMsg   by remember { mutableStateOf<String?>(null) }

    val focusRequester = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
        keyboard?.show()
    }

    AuthBackdrop {

        // Toasts
        Column(modifier = Modifier.statusBarsPadding().zIndex(10f)) {
            TutorUGToast(message = errorMsg, type = ToastType.ERROR, onDismiss = { errorMsg = null })
            TutorUGToast(message = resendMsg, type = ToastType.SUCCESS, onDismiss = { resendMsg = null })
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
                Text("Enter OTP", fontFamily = Baloo, fontSize = 20.sp,
                    fontWeight = FontWeight.Black, color = AppColors.textPrimary)
            }

            Column(
                modifier = Modifier.fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .imePadding().navigationBarsPadding().padding(horizontal = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(24.dp))

                // ── Icon badge: gold gradient circle with a soft glow ──────────
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
                            Icons.Default.Email, null, tint = Color(0xFF1A1000),
                            modifier = Modifier.size(40.dp).align(Alignment.Center)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // ── Display typography + neutral email ─────────────────────────
                Text("Check your email",
                    fontFamily = Baloo, fontSize = 26.sp, fontWeight = FontWeight.Black,
                    color = AppColors.textPrimary, textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(8.dp))
                Text("We sent a 6-digit code to", fontSize = 14.sp,
                    color = AppColors.onSurfaceVar, textAlign = TextAlign.Center)
                Text(email, fontFamily = Baloo, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
                    color = AppColors.textPrimary, textAlign = TextAlign.Center)

                Spacer(modifier = Modifier.height(28.dp))

                // ── OTP: six gold-bordered digit slots + invisible capture field ─
                Box(modifier = Modifier.fillMaxWidth().height(60.dp)) {
                    Row(
                        modifier = Modifier.fillMaxSize(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        repeat(6) { i ->
                            val active = i == otp.length && otp.length < 6
                            Box(
                                modifier = Modifier.weight(1f).fillMaxHeight()
                                    .background(AppColors.surfaceInput.copy(alpha = 0.55f), RoundedCornerShape(14.dp))
                                    .border(
                                        1.dp,
                                        Brush.linearGradient(
                                            listOf(
                                                Amber400.copy(alpha = if (active) 0.95f else 0.45f),
                                                AppColors.outline.copy(alpha = 0.10f)
                                            )
                                        ),
                                        RoundedCornerShape(14.dp)
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    otp.getOrNull(i)?.toString() ?: "",
                                    fontFamily = Baloo, fontSize = 22.sp, fontWeight = FontWeight.Bold,
                                    color = AppColors.textPrimary
                                )
                            }
                        }
                    }
                    BasicTextField(
                        value = otp,
                        onValueChange = { new ->
                            if (new.length <= 6 && new.all { it.isDigit() }) {
                                otp = new
                                errorMsg = null
                            }
                        },
                        modifier = Modifier.fillMaxSize().focusRequester(focusRequester),
                        textStyle = TextStyle(color = Color.Transparent, fontSize = 1.sp),
                        cursorBrush = SolidColor(Color.Transparent),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        decorationBox = { }
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // ── Primary CTA: gold ──────────────────────────────────────────
                GoldButton(
                    label = "Verify Code",
                    onClick = {
                        isLoading = true
                        errorMsg = null
                        onVerifyOtp(email, otp) { success, msg ->
                            isLoading = false
                            if (success) onVerified()
                            else errorMsg = msg
                        }
                    },
                    enabled = otp.length == 6 && !isLoading,
                    loading = isLoading
                )

                Spacer(modifier = Modifier.height(20.dp))

                // ── Resend ─────────────────────────────────────────────────────
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Didn't receive it? ", fontSize = 14.sp, color = AppColors.onSurfaceVar)
                    if (isResending) {
                        CircularProgressIndicator(modifier = Modifier.size(14.dp), color = Amber400, strokeWidth = 2.dp)
                    } else {
                        Text(
                            "Resend Code",
                            fontSize = 14.sp, color = Amber400, fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.noRippleClickable {
                                isResending = true
                                resendMsg = null
                                errorMsg = null
                                onResendOtp(email) { success, _ ->
                                    isResending = false
                                    otp = ""
                                    resendMsg = if (success) "New code sent!" else "Failed to resend. Try again."
                                }
                            }
                        )
                    }
                }

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