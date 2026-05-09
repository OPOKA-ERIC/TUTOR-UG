package com.tutorug.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.tutorug.app.R
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

    val bg      = AppColors.background
    val surface = AppColors.surface
    val primary = AppColors.primary
    val onPrimary = AppColors.onPrimary
    val tertiary  = AppColors.tertiary
    val outline   = AppColors.outline
    val surfaceInput = AppColors.surfaceInput
    val onSurfaceVar = AppColors.onSurfaceVar

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor     = AppColors.textPrimary,
        unfocusedTextColor   = AppColors.textPrimary,
        focusedBorderColor   = primary,
        unfocusedBorderColor = outline,
        focusedContainerColor    = surfaceInput,
        unfocusedContainerColor  = surfaceInput,
        cursorColor          = primary,
        focusedLabelColor    = primary,
        unfocusedLabelColor  = onSurfaceVar
    )

    Box(
        modifier = Modifier.fillMaxSize()
            .background(Brush.verticalGradient(listOf(surface, bg)))
    ) {
        // Toast
        Column(modifier = Modifier.statusBarsPadding().zIndex(10f)) {
            TutorUGToast(
                message = if (authState is AuthState.Error) (authState as AuthState.Error).message else null,
                type = ToastType.ERROR,
                onDismiss = { viewModel.clearError() }
            )
        }

        Box(
            modifier = Modifier.size(300.dp).offset(x = (-70).dp, y = (-70).dp)
                .background(Brush.radialGradient(listOf(primary.copy(alpha = 0.1f), Color.Transparent)), CircleShape)
        )
        Box(
            modifier = Modifier.size(220.dp).align(Alignment.BottomEnd).offset(x = 60.dp, y = 60.dp)
                .background(Brush.radialGradient(listOf(tertiary.copy(alpha = 0.1f), Color.Transparent)), CircleShape)
        )

        Column(
            modifier = Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()
                .verticalScroll(rememberScrollState()).padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(64.dp))

            Box(
                modifier = Modifier.size(84.dp)
                    .background(Brush.linearGradient(listOf(Amber400, Amber600)), RoundedCornerShape(22.dp)),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ic_tutorug_logo),
                    contentDescription = "TutorUG Logo",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp))
                )
            }

            Spacer(modifier = Modifier.height(28.dp))
            Text("Welcome Back! 👋", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = AppColors.textPrimary)
            Text("Sign in to continue learning", fontSize = 15.sp, color = onSurfaceVar, modifier = Modifier.padding(top = 6.dp))
            Spacer(modifier = Modifier.height(40.dp))

            Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = surface) {
                Column(modifier = Modifier.padding(24.dp)) {

                    Text("Email", fontSize = 13.sp, color = onSurfaceVar, fontWeight = FontWeight.Medium)
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(
                        value = email, onValueChange = { email = it },
                        placeholder = { Text("your@email.com", color = AppColors.textDisabled) },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.Email, null, tint = primary, modifier = Modifier.size(20.dp)) },
                        colors = fieldColors, shape = RoundedCornerShape(12.dp), singleLine = true
                    )

                    Spacer(modifier = Modifier.height(18.dp))
                    Text("Password", fontSize = 13.sp, color = onSurfaceVar, fontWeight = FontWeight.Medium)
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(
                        value = password, onValueChange = { password = it },
                        placeholder = { Text("••••••••", color = AppColors.textDisabled) },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.Lock, null, tint = primary, modifier = Modifier.size(20.dp)) },
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    null, tint = onSurfaceVar, modifier = Modifier.size(20.dp))
                            }
                        },
                        colors = fieldColors, shape = RoundedCornerShape(12.dp), singleLine = true
                    )

                    Row(modifier = Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.End) {
                        Text("Forgot Password?", color = primary, fontSize = 13.sp,
                            fontWeight = FontWeight.Medium, modifier = Modifier.clickable { onForgotPasswordClick() })
                    }

                    Spacer(modifier = Modifier.height(26.dp))



                    val canLogin = authState !is AuthState.Loading && email.isNotBlank() && password.isNotBlank()
                    Button(
                        onClick = { viewModel.login(email, password) },
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                        contentPadding = PaddingValues(0.dp), enabled = canLogin
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize().background(
                                if (canLogin) Brush.linearGradient(listOf(Amber400, Amber600))
                                else Brush.linearGradient(listOf(surfaceInput, surfaceInput)),
                                RoundedCornerShape(14.dp)
                            ),
                            contentAlignment = Alignment.Center
                        ) {
                            if (authState is AuthState.Loading)
                                CircularProgressIndicator(modifier = Modifier.size(22.dp), color = onPrimary, strokeWidth = 2.dp)
                            else
                                Text("Sign In", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = onPrimary)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                HorizontalDivider(modifier = Modifier.weight(1f), color = outline)
                Text("  or  ", color = onSurfaceVar, fontSize = 13.sp)
                HorizontalDivider(modifier = Modifier.weight(1f), color = outline)
            }
            Spacer(modifier = Modifier.height(24.dp))

            OutlinedButton(
                onClick = onRegisterClick,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp),
                border = ButtonDefaults.outlinedButtonBorder.copy(
                    brush = Brush.linearGradient(listOf(primary.copy(alpha = 0.6f), tertiary.copy(alpha = 0.6f)))
                )
            ) {
                Text("Create New Account", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = primary)
            }

            Spacer(modifier = Modifier.height(32.dp))
            Text("🇺🇬  Empowering Ugandan Students", fontSize = 13.sp, color = onSurfaceVar, textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(24.dp))
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
