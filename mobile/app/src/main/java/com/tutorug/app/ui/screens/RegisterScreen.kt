package com.tutorug.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
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
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.theme.*
import com.tutorug.app.viewmodel.AuthState
import com.tutorug.app.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
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
    var districtExpanded by remember { mutableStateOf(false) }
    var levelExpanded by remember { mutableStateOf(false) }

    val isALevel       = selectedLevel in listOf("S5", "S6")
    val isUniversity   = selectedLevel == "University"
    val isProfessional = selectedLevel == "Professional"

    LaunchedEffect(authState) { if (authState is AuthState.Registered) onRegisterSuccess() }
    DisposableEffect(Unit) { onDispose { viewModel.clearError() } }

    val bg           = AppColors.background
    val surface      = AppColors.surface
    val primary      = AppColors.primary
    val onPrimary    = AppColors.onPrimary
    val tertiary     = AppColors.tertiary
    val outline      = AppColors.outline
    val surfaceInput = AppColors.surfaceInput
    val onSurfaceVar = AppColors.onSurfaceVar
    val barStart     = AppColors.barStart
    val barEnd       = AppColors.barEnd

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

    Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(surface, bg)))) {

        // Decorative blob
        Box(
            modifier = Modifier.size(260.dp).offset(x = 100.dp, y = (-40).dp)
                .background(Brush.radialGradient(listOf(tertiary.copy(alpha = 0.1f), Color.Transparent)), CircleShape)
        )

        // Toast overlay
        Column(modifier = Modifier.statusBarsPadding().zIndex(10f)) {
            TutorUGToast(
                message = if (authState is AuthState.Error) (authState as AuthState.Error).message else null,
                type = ToastType.ERROR,
                onDismiss = { viewModel.clearError() }
            )
        }

        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {

            // Top bar
            Box(
                modifier = Modifier.fillMaxWidth()
                    .background(Brush.horizontalGradient(listOf(barStart, barEnd)))
                    .padding(horizontal = 20.dp, vertical = 16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    AppLogo()
                    Spacer(modifier = Modifier.width(12.dp))
                    Text("Create Account", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = AppColors.textPrimary)
                }
            }

            Column(
                modifier = Modifier.fillMaxSize().imePadding().navigationBarsPadding()
                    .verticalScroll(rememberScrollState()).padding(24.dp)
            ) {
                Spacer(modifier = Modifier.height(4.dp))

                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Full Name") },
                    modifier = Modifier.fillMaxWidth(), colors = fieldColors, singleLine = true, shape = RoundedCornerShape(12.dp))
                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") },
                    modifier = Modifier.fillMaxWidth(), colors = fieldColors, singleLine = true, shape = RoundedCornerShape(12.dp))
                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = password, onValueChange = { password = it }, label = { Text("Password") },
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff, null, tint = onSurfaceVar)
                        }
                    },
                    colors = fieldColors, singleLine = true, shape = RoundedCornerShape(12.dp)
                )
                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = confirmPassword, onValueChange = { confirmPassword = it }, label = { Text("Confirm Password") },
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = if (confirmPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { confirmPasswordVisible = !confirmPasswordVisible }) {
                            Icon(if (confirmPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff, null, tint = onSurfaceVar)
                        }
                    },
                    colors = fieldColors, singleLine = true, shape = RoundedCornerShape(12.dp)
                )
                Spacer(modifier = Modifier.height(14.dp))

                ExposedDropdownMenuBox(expanded = districtExpanded, onExpandedChange = { districtExpanded = it }) {
                    OutlinedTextField(
                        value = selectedDistrict, onValueChange = {}, readOnly = true, label = { Text("Select District") },
                        trailingIcon = { Icon(Icons.Default.ArrowDropDown, null, tint = primary) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(), colors = fieldColors, shape = RoundedCornerShape(12.dp)
                    )
                    ExposedDropdownMenu(expanded = districtExpanded, onDismissRequest = { districtExpanded = false },
                        modifier = Modifier.background(surface)) {
                        districts.forEach { district ->
                            DropdownMenuItem(text = { Text(district, color = AppColors.textPrimary) },
                                onClick = { selectedDistrict = district; districtExpanded = false })
                        }
                    }
                }
                Spacer(modifier = Modifier.height(14.dp))

                ExposedDropdownMenuBox(expanded = levelExpanded, onExpandedChange = { levelExpanded = it }) {
                    OutlinedTextField(
                        value = selectedLevel, onValueChange = {}, readOnly = true, label = { Text("Education Level") },
                        trailingIcon = { Icon(Icons.Default.ArrowDropDown, null, tint = primary) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(), colors = fieldColors, shape = RoundedCornerShape(12.dp)
                    )
                    ExposedDropdownMenu(expanded = levelExpanded, onDismissRequest = { levelExpanded = false },
                        modifier = Modifier.background(surface)) {
                        educationLevels.forEach { level ->
                            DropdownMenuItem(text = { Text(level, color = AppColors.textPrimary) },
                                onClick = { selectedLevel = level; levelExpanded = false })
                        }
                    }
                }
                Spacer(modifier = Modifier.height(14.dp))

                if (isALevel) {
                    InfoHint("Enter your subject combination (e.g. PCB, HEG, MEG). General Paper is always included.", primary)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(value = combination, onValueChange = { combination = it },
                        label = { Text("Subject Combination (e.g. PCB, HEG)") },
                        modifier = Modifier.fillMaxWidth(), colors = fieldColors, singleLine = true, shape = RoundedCornerShape(12.dp))
                    Spacer(modifier = Modifier.height(14.dp))
                }
                if (isUniversity) {
                    InfoHint("Your AI tutor will focus all learning around your university course.", primary)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(value = course, onValueChange = { course = it },
                        label = { Text("University Course (e.g. Bachelor of Medicine)") },
                        modifier = Modifier.fillMaxWidth(), colors = fieldColors, singleLine = true, shape = RoundedCornerShape(12.dp))
                    Spacer(modifier = Modifier.height(14.dp))
                }
                if (isProfessional) {
                    InfoHint("Your AI tutor will focus all learning around your profession.", primary)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(value = profession, onValueChange = { profession = it },
                        label = { Text("Your Profession (e.g. Nurse, Engineer, Teacher)") },
                        modifier = Modifier.fillMaxWidth(), colors = fieldColors, singleLine = true, shape = RoundedCornerShape(12.dp))
                    Spacer(modifier = Modifier.height(14.dp))
                }
                if (!isUniversity && !isProfessional) {
                    OutlinedTextField(value = school, onValueChange = { school = it }, label = { Text("School (Optional)") },
                        modifier = Modifier.fillMaxWidth(), colors = fieldColors, singleLine = true, shape = RoundedCornerShape(12.dp))
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

                Button(
                    onClick = {
                        if (password == confirmPassword)
                            viewModel.register(email, password, UserProfile(
                                name = name, district = selectedDistrict, educationLevel = selectedLevel,
                                school = school, combination = combination, course = course, profession = profession))
                    },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = PaddingValues(0.dp), enabled = canRegister
                ) {
                    Box(
                        modifier = Modifier.fillMaxSize().background(
                            if (canRegister) Brush.linearGradient(listOf(Amber400, Amber600))
                            else Brush.linearGradient(listOf(surfaceInput, surfaceInput)),
                            RoundedCornerShape(14.dp)
                        ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (authState is AuthState.Loading)
                            CircularProgressIndicator(modifier = Modifier.size(24.dp), color = onPrimary, strokeWidth = 2.dp)
                        else
                            Text("Create Account", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = onPrimary)
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { onLoginClick() }) {
                    Text("Already have an account? ", color = onSurfaceVar, fontSize = 14.sp)
                    Text("Sign In", color = primary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.height(32.dp))
            }
        }

        if (authState is AuthState.Loading) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.5f)).clickable(enabled = false) {},
                contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = primary)
            }
        }
    }
}

@Composable
private fun InfoHint(text: String, primary: Color) {
    Surface(modifier = Modifier.fillMaxWidth(), color = primary.copy(alpha = 0.08f), shape = RoundedCornerShape(10.dp)) {
        Text(text, fontSize = 12.sp, color = AppColors.textMuted, modifier = Modifier.padding(12.dp))
    }
}
