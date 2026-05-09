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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.tutorug.app.ui.theme.*

@Composable
fun NewPasswordScreen(
    email: String,
    onBackClick: () -> Unit,
    onPasswordReset: (String, String, (Boolean, String) -> Unit) -> Unit,
    onSuccess: () -> Unit
) {
    var newPassword     by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var newVisible      by remember { mutableStateOf(false) }
    var confirmVisible  by remember { mutableStateOf(false) }
    var isLoading       by remember { mutableStateOf(false) }
    var errorMsg        by remember { mutableStateOf<String?>(null) }

    val bg           = AppColors.background
    val surface      = AppColors.surface
    val primary      = AppColors.primary
    val onPrimary    = AppColors.onPrimary
    val outline      = AppColors.outline
    val surfaceInput = AppColors.surfaceInput
    val onSurfaceVar = AppColors.onSurfaceVar
    val barStart     = AppColors.barStart
    val barEnd       = AppColors.barEnd

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = TextWhite, unfocusedTextColor = TextLight,
        focusedBorderColor = primary, unfocusedBorderColor = outline,
        focusedContainerColor = surfaceInput, unfocusedContainerColor = surfaceInput,
        cursorColor = primary, focusedLabelColor = primary, unfocusedLabelColor = onSurfaceVar
    )

    val passwordsMatch = newPassword == confirmPassword
    val isValid = newPassword.length >= 6 && passwordsMatch && confirmPassword.isNotBlank() && !isLoading

    Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(surface, bg)))) {

        // Toast
        Column(modifier = Modifier.statusBarsPadding().zIndex(10f)) {
            TutorUGToast(message = errorMsg, type = ToastType.ERROR, onDismiss = { errorMsg = null })
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
                    Text("New Password", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                }
            }

            Column(
                modifier = Modifier.fillMaxSize().imePadding().navigationBarsPadding().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Spacer(modifier = Modifier.height(16.dp))

                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Box(
                        modifier = Modifier.size(72.dp).background(primary.copy(alpha = 0.12f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.LockOpen, null, tint = primary, modifier = Modifier.size(36.dp))
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))
                Text("Set a new password", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                Text("Choose a strong password for your account.", fontSize = 14.sp, color = onSurfaceVar)

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it; errorMsg = null },
                    label = { Text("New Password") },
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = if (newVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { newVisible = !newVisible }) {
                            Icon(if (newVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                null, tint = onSurfaceVar)
                        }
                    },
                    colors = fieldColors, singleLine = true, shape = RoundedCornerShape(12.dp)
                )

                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it; errorMsg = null },
                    label = { Text("Confirm New Password") },
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = if (confirmVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { confirmVisible = !confirmVisible }) {
                            Icon(if (confirmVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                null, tint = onSurfaceVar)
                        }
                    },
                    isError = confirmPassword.isNotBlank() && !passwordsMatch,
                    supportingText = {
                        if (confirmPassword.isNotBlank() && !passwordsMatch)
                            Text("Passwords do not match", color = AppColors.error, fontSize = 12.sp)
                    },
                    colors = fieldColors, singleLine = true, shape = RoundedCornerShape(12.dp)
                )

                // error shown via toast above

                Button(
                    onClick = {
                        isLoading = true
                        errorMsg = null
                        onPasswordReset(email, newPassword) { success, msg ->
                            isLoading = false
                            if (success) onSuccess()
                            else errorMsg = msg
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = PaddingValues(0.dp),
                    enabled = isValid
                ) {
                    Box(
                        modifier = Modifier.fillMaxSize().background(
                            if (isValid) Brush.linearGradient(listOf(Amber400, Amber600))
                            else Brush.linearGradient(listOf(surfaceInput, surfaceInput)),
                            RoundedCornerShape(14.dp)
                        ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isLoading)
                            CircularProgressIndicator(modifier = Modifier.size(22.dp), color = onPrimary, strokeWidth = 2.dp)
                        else
                            Text("Reset Password", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = onPrimary)
                    }
                }
            }
        }
    }
}
