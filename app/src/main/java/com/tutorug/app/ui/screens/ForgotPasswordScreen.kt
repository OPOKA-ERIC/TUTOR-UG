package com.tutorug.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
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

        // Toast
        Column(modifier = Modifier.statusBarsPadding().zIndex(10f)) {
            TutorUGToast(
                message = errorMsg,
                type = ToastType.ERROR,
                onDismiss = { errorMsg = null }
            )
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
                    Text("Reset Password", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                }
            }

            Column(
                modifier = Modifier.fillMaxSize().imePadding().navigationBarsPadding().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Spacer(modifier = Modifier.height(16.dp))

                // Icon
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Box(
                        modifier = Modifier.size(72.dp)
                            .background(primary.copy(alpha = 0.12f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Lock, null, tint = primary, modifier = Modifier.size(36.dp))
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
                Text("Forgot your password?", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                Text(
                    "Enter the email address linked to your account and we'll send you a 6-digit reset code.",
                    fontSize = 14.sp, color = onSurfaceVar, lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it; errorMsg = null },
                    label = { Text("Email Address") },
                    placeholder = { Text("your@email.com", color = TextDisabled) },
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { Icon(Icons.Default.Email, null, tint = primary, modifier = Modifier.size(20.dp)) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextWhite, unfocusedTextColor = TextLight,
                        focusedBorderColor = primary, unfocusedBorderColor = outline,
                        focusedContainerColor = surfaceInput, unfocusedContainerColor = surfaceInput,
                        cursorColor = primary, focusedLabelColor = primary, unfocusedLabelColor = onSurfaceVar
                    ),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )

                errorMsg?.let {
                    // shown via toast above
                }

                val canSubmit = email.isNotBlank() && !isLoading

                Button(
                    onClick = {
                        isLoading = true
                        errorMsg = null
                        onSendOtp(email.trim()) { success, msg ->
                            isLoading = false
                            if (success) onOtpSent(email.trim())
                            else errorMsg = msg
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = PaddingValues(0.dp),
                    enabled = canSubmit
                ) {
                    Box(
                        modifier = Modifier.fillMaxSize().background(
                            if (canSubmit) Brush.linearGradient(listOf(Amber400, Amber600))
                            else Brush.linearGradient(listOf(surfaceInput, surfaceInput)),
                            RoundedCornerShape(14.dp)
                        ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isLoading)
                            CircularProgressIndicator(modifier = Modifier.size(22.dp), color = onPrimary, strokeWidth = 2.dp)
                        else
                            Text("Send Reset Code", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = onPrimary)
                    }
                }
            }
        }
    }
}
