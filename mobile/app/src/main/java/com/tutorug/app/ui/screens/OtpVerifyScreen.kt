package com.tutorug.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.tutorug.app.ui.theme.*

@Composable
fun OtpVerifyScreen(
    email: String,
    onBackClick: () -> Unit,
    onVerified: () -> Unit,
    onResendOtp: (String, (Boolean, String) -> Unit) -> Unit,
    onVerifyOtp: (String, String, (Boolean, String) -> Unit) -> Unit
) {
    var otp          by remember { mutableStateOf("") }
    var isLoading    by remember { mutableStateOf(false) }
    var isResending  by remember { mutableStateOf(false) }
    var errorMsg     by remember { mutableStateOf<String?>(null) }
    var resendMsg    by remember { mutableStateOf<String?>(null) }

    val bg           = AppColors.background
    val surface      = AppColors.surface
    val primary      = AppColors.primary
    val onPrimary    = AppColors.onPrimary
    val outline      = AppColors.outline
    val surfaceInput = AppColors.surfaceInput
    val onSurfaceVar = AppColors.onSurfaceVar
    val barStart     = AppColors.barStart
    val barEnd       = AppColors.barEnd

    Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(surface, bg)))) {

        // Toasts
        Column(modifier = Modifier.statusBarsPadding().zIndex(10f)) {
            TutorUGToast(message = errorMsg, type = ToastType.ERROR, onDismiss = { errorMsg = null })
            TutorUGToast(message = resendMsg, type = ToastType.SUCCESS, onDismiss = { resendMsg = null })
        }

        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {

            // Top bar
            Box(
                modifier = Modifier.fillMaxWidth()
                    .background(Brush.horizontalGradient(listOf(barStart, barEnd)))
                    .padding(horizontal = 8.dp, vertical = 8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier.size(48.dp).noRippleClickable { onBackClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Box(modifier = Modifier.size(36.dp).background(AppColors.surfaceInput, CircleShape),
                            contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.ArrowBack, null, tint = TextWhite, modifier = Modifier.size(18.dp))
                        }
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                    AppLogo()
                    Spacer(modifier = Modifier.width(10.dp))
                    Text("Enter OTP", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                }
            }

            Column(
                modifier = Modifier.fillMaxSize().imePadding().navigationBarsPadding().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Spacer(modifier = Modifier.height(16.dp))

                Box(
                    modifier = Modifier.size(72.dp).background(primary.copy(alpha = 0.12f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Email, null, tint = primary, modifier = Modifier.size(36.dp))
                }

                Spacer(modifier = Modifier.height(4.dp))
                Text("Check your email", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                Text(
                    "We sent a 6-digit code to\n$email",
                    fontSize = 14.sp, color = onSurfaceVar, textAlign = TextAlign.Center, lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                // OTP input
                OutlinedTextField(
                    value = otp,
                    onValueChange = { if (it.length <= 6 && it.all { c -> c.isDigit() }) { otp = it; errorMsg = null } },
                    label = { Text("6-Digit Code") },
                    placeholder = { Text("000000", color = TextDisabled) },
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { Icon(Icons.Default.Pin, null, tint = primary, modifier = Modifier.size(20.dp)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextWhite, unfocusedTextColor = TextLight,
                        focusedBorderColor = primary, unfocusedBorderColor = outline,
                        focusedContainerColor = surfaceInput, unfocusedContainerColor = surfaceInput,
                        cursorColor = primary, focusedLabelColor = primary, unfocusedLabelColor = onSurfaceVar
                    ),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )

                // errors shown via toast above

                val canVerify = otp.length == 6 && !isLoading

                Button(
                    onClick = {
                        isLoading = true
                        errorMsg = null
                        onVerifyOtp(email, otp) { success, msg ->
                            isLoading = false
                            if (success) onVerified()
                            else errorMsg = msg
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = PaddingValues(0.dp),
                    enabled = canVerify
                ) {
                    Box(
                        modifier = Modifier.fillMaxSize().background(
                            if (canVerify) Brush.linearGradient(listOf(Amber400, Amber600))
                            else Brush.linearGradient(listOf(surfaceInput, surfaceInput)),
                            RoundedCornerShape(14.dp)
                        ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isLoading)
                            CircularProgressIndicator(modifier = Modifier.size(22.dp), color = onPrimary, strokeWidth = 2.dp)
                        else
                            Text("Verify Code", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = onPrimary)
                    }
                }

                // Resend
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Didn't receive it? ", fontSize = 14.sp, color = onSurfaceVar)
                    if (isResending) {
                        CircularProgressIndicator(modifier = Modifier.size(14.dp), color = primary, strokeWidth = 2.dp)
                    } else {
                        Text(
                            "Resend Code",
                            fontSize = 14.sp, color = primary, fontWeight = FontWeight.SemiBold,
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
            }
        }
    }
}
