package com.tutorug.app.ui.screens

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.components.AuthBackdrop
import com.tutorug.app.ui.components.AuthDropdown
import com.tutorug.app.ui.components.AuthTextField
import com.tutorug.app.ui.components.GoldButton
import com.tutorug.app.ui.theme.*
import com.tutorug.app.viewmodel.AuthState
import com.tutorug.app.viewmodel.AuthViewModel

@Composable
fun RegisterScreen(
    viewModel: AuthViewModel,
    onRegisterSuccess: () -> Unit,
    onLoginClick: () -> Unit
) {
    val authState by viewModel.authState.collectAsState()
    val districts by viewModel.districts.collectAsState()
    val educationLevels by viewModel.educationLevels.collectAsState()

    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var selectedDistrict by remember { mutableStateOf("") }
    var selectedLevel by remember { mutableStateOf("") }
    var school by remember { mutableStateOf("") }
    var combination by remember { mutableStateOf("") }
    var course by remember { mutableStateOf("") }
    var profession by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmPasswordVisible by remember { mutableStateOf(false) }

    val isALevel       = selectedLevel in listOf("S5", "S6")
    val isUniversity   = selectedLevel == "University"
    val isProfessional = selectedLevel == "Professional"

    LaunchedEffect(authState) { if (authState is AuthState.Registered) onRegisterSuccess() }
    DisposableEffect(Unit) { onDispose { viewModel.clearError() } }

    val surface = AppColors.surface
    val primary = AppColors.primary

    AuthBackdrop {
        // Toast
        Column(modifier = Modifier.statusBarsPadding().zIndex(10f)) {
            TutorUGToast(
                message = if (authState is AuthState.Error) (authState as AuthState.Error).message else null,
                type = ToastType.ERROR,
                onDismiss = { viewModel.clearError() }
            )
        }

        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {

            // ── Header: logo + title, blended straight into the backdrop ───────
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AppLogo()
                Spacer(modifier = Modifier.width(12.dp))
                Text("Create Account", fontFamily = Baloo, fontSize = 22.sp,
                    fontWeight = FontWeight.Black, color = AppColors.textPrimary)
            }

            Column(
                modifier = Modifier.fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .imePadding().navigationBarsPadding().padding(horizontal = 28.dp)
            ) {
                Text(
                    "Join TutorUG and find the perfect tutor for you.",
                    fontFamily = Baloo, fontSize = 13.sp, fontWeight = FontWeight.Medium,
                    color = AppColors.onSurfaceVar, modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(24.dp))

                // ── Personal Info ──────────────────────────────────────────────
                SectionHeader("Personal Info")
                Spacer(modifier = Modifier.height(14.dp))

                AuthTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = "Full Name",
                    placeholder = "e.g. Okello James",
                    leadingIcon = { Icon(Icons.Default.Person, null, tint = Amber400, modifier = Modifier.size(20.dp)) }
                )
                Spacer(modifier = Modifier.height(14.dp))

                AuthTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = "Email",
                    placeholder = "you@example.com",
                    leadingIcon = { Icon(Icons.Default.Email, null, tint = Amber400, modifier = Modifier.size(20.dp)) }
                )
                Spacer(modifier = Modifier.height(14.dp))

                AuthTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = "Password",
                    placeholder = "At least 6 characters",
                    password = true,
                    leadingIcon = { Icon(Icons.Default.Lock, null, tint = Amber400, modifier = Modifier.size(20.dp)) },
                    trailing = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                null, tint = Amber400, modifier = Modifier.size(20.dp))
                        }
                    }
                )
                Spacer(modifier = Modifier.height(14.dp))

                val passwordsMatch = confirmPassword == password
                AuthTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    label = "Confirm Password",
                    password = true,
                    isError = confirmPassword.isNotBlank() && !passwordsMatch,
                    supportingText = {
                        if (confirmPassword.isNotBlank() && !passwordsMatch)
                            Text("Passwords do not match", color = AppColors.error, fontSize = 12.sp)
                    },
                    leadingIcon = { Icon(Icons.Default.Lock, null, tint = Amber400, modifier = Modifier.size(20.dp)) },
                    trailing = {
                        IconButton(onClick = { confirmPasswordVisible = !confirmPasswordVisible }) {
                            Icon(if (confirmPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                null, tint = Amber400, modifier = Modifier.size(20.dp))
                        }
                    }
                )

                Spacer(modifier = Modifier.height(28.dp))

                // ── Education Info ─────────────────────────────────────────────
                SectionHeader("Education Info")
                Spacer(modifier = Modifier.height(14.dp))

                AuthDropdown(
                    value = selectedDistrict,
                    label = "District",
                    options = districts,
                    onSelected = { selectedDistrict = it },
                    placeholder = "Select your district",
                    leadingIcon = { Icon(Icons.Default.Place, null, tint = Amber400, modifier = Modifier.size(20.dp)) }
                )
                Spacer(modifier = Modifier.height(14.dp))

                AuthDropdown(
                    value = selectedLevel,
                    label = "Education Level",
                    options = educationLevels,
                    onSelected = { selectedLevel = it },
                    placeholder = "e.g. Senior 4, University",
                    leadingIcon = { Icon(Icons.Default.School, null, tint = Amber400, modifier = Modifier.size(20.dp)) }
                )
                Spacer(modifier = Modifier.height(14.dp))

                if (isALevel) {
                    InfoHint("Enter your subject combination (e.g. PCB, HEG, MEG). General Paper is always included.")
                    Spacer(modifier = Modifier.height(10.dp))
                    AuthTextField(
                        value = combination,
                        onValueChange = { combination = it },
                        label = "Subject Combination",
                        placeholder = "e.g. PCB, HEG",
                        leadingIcon = { Icon(Icons.Default.AutoStories, null, tint = Amber400, modifier = Modifier.size(20.dp)) }
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                }
                if (isUniversity) {
                    InfoHint("Your AI tutor will focus all learning around your university course.")
                    Spacer(modifier = Modifier.height(10.dp))
                    AuthTextField(
                        value = course,
                        onValueChange = { course = it },
                        label = "University Course",
                        placeholder = "e.g. Bachelor of Medicine",
                        leadingIcon = { Icon(Icons.Default.MenuBook, null, tint = Amber400, modifier = Modifier.size(20.dp)) }
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                }
                if (isProfessional) {
                    InfoHint("Your AI tutor will focus all learning around your profession.")
                    Spacer(modifier = Modifier.height(10.dp))
                    AuthTextField(
                        value = profession,
                        onValueChange = { profession = it },
                        label = "Your Profession",
                        placeholder = "e.g. Nurse, Engineer, Teacher",
                        leadingIcon = { Icon(Icons.Default.Work, null, tint = Amber400, modifier = Modifier.size(20.dp)) }
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                }
                if (!isUniversity && !isProfessional) {
                    AuthTextField(
                        value = school,
                        onValueChange = { school = it },
                        label = "School (Optional)",
                        placeholder = "School name",
                        leadingIcon = { Icon(Icons.Default.Business, null, tint = Amber400, modifier = Modifier.size(20.dp)) }
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                }

                val extraValid = when {
                    isALevel       -> combination.isNotBlank()
                    isUniversity   -> course.isNotBlank()
                    isProfessional -> profession.isNotBlank()
                    else           -> true
                }
                val canRegister = authState !is AuthState.Loading && name.isNotBlank() && email.isNotBlank() &&
                        password.isNotBlank() && password == confirmPassword &&
                        selectedDistrict.isNotBlank() && selectedLevel.isNotBlank() && extraValid

                Spacer(modifier = Modifier.height(8.dp))

                // ── Primary CTA: gold, the clear visual anchor ─────────────────
                GoldButton(
                    label = "Create Account",
                    onClick = {
                        if (password == confirmPassword)
                            viewModel.register(email, password, UserProfile(
                                name = name, district = selectedDistrict, educationLevel = selectedLevel,
                                school = school, combination = combination, course = course, profession = profession))
                    },
                    enabled = canRegister,
                    loading = authState is AuthState.Loading
                )

                Spacer(modifier = Modifier.height(20.dp))

                // ── Footer: kept as-is ─────────────────────────────────────────
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { onLoginClick() },
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Already have an account? ", color = AppColors.onSurfaceVar, fontSize = 14.sp)
                    Text("Sign In", color = Amber400, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }

                Spacer(modifier = Modifier.height(32.dp))
            }
        }

        if (authState is AuthState.Loading) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.55f)),
                contentAlignment = Alignment.Center) {
                Surface(shape = RoundedCornerShape(20.dp), color = surface) {
                    Column(modifier = Modifier.padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = primary, strokeWidth = 3.dp)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Creating your account...", color = AppColors.textMuted, fontSize = 14.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(text: String) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(width = 4.dp, height = 18.dp).background(Amber400, RoundedCornerShape(2.dp)))
        Spacer(modifier = Modifier.width(8.dp))
        Text(text.uppercase(), fontFamily = Baloo, fontSize = 12.sp, fontWeight = FontWeight.Bold,
            letterSpacing = 1.2.sp, color = Amber400)
    }
}

@Composable
private fun InfoHint(text: String) {
    Surface(modifier = Modifier.fillMaxWidth(), color = AppColors.surfaceInput.copy(alpha = 0.55f),
        shape = RoundedCornerShape(12.dp)) {
        Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(5.dp).background(Amber400, CircleShape))
            Spacer(modifier = Modifier.width(10.dp))
            Text(text, fontSize = 12.sp, color = AppColors.textMuted, lineHeight = 16.sp)
        }
    }
}