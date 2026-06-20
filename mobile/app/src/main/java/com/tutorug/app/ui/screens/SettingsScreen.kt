package com.tutorug.app.ui.screens

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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.theme.*
import com.tutorug.app.viewmodel.AppTheme
import com.tutorug.app.viewmodel.AvatarUploadState
import com.tutorug.app.viewmodel.QuizDifficulty

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    userProfile: UserProfile = UserProfile(),
    onBackClick: () -> Unit = {},
    onLogout: () -> Unit = {},
    onAvatarClick: () -> Unit = {},
    onLearningProgressClick: () -> Unit = {},
    onTimetableClick: () -> Unit = {},
    onPrivacyPolicyClick: () -> Unit = {},
    onTermsClick: () -> Unit = {},
    onShareClick: () -> Unit = {},
    onChangePasswordClick: () -> Unit = {},
    avatarUploadState: AvatarUploadState = AvatarUploadState.Idle,
    // Location
    locationEnabled: Boolean = false,
    onLocationToggle: (Boolean) -> Unit = {},
    detectedDistrict: String? = null,
    allDistricts: List<String> = emptyList(),
    currentDistrict: String = "",
    onDistrictChange: (String) -> Unit = {},
    // Education
    allEducationLevels: List<String> = emptyList(),
    onEducationChange: (level: String, school: String, combination: String, course: String, profession: String) -> Unit = { _, _, _, _, _ -> },
    // Voice
    voiceEnabled: Boolean = true,
    onVoiceToggle: (Boolean) -> Unit = {},
    autoReadEnabled: Boolean = false,
    onAutoReadToggle: (Boolean) -> Unit = {},
    speechRate: Float = 1.0f,
    onSpeechRateChange: (Float) -> Unit = {},
    voiceGenderMale: Boolean = false,
    onVoiceGenderChange: (Boolean) -> Unit = {},
    quizSoundEnabled: Boolean = true,
    onQuizSoundToggle: (Boolean) -> Unit = {},
    // Notifications
    notificationsEnabled: Boolean = true,
    onNotificationsToggle: (Boolean) -> Unit = {},
    studyRemindersEnabled: Boolean = true,
    onStudyRemindersToggle: (Boolean) -> Unit = {},
    // Learning
    quizDifficulty: QuizDifficulty = QuizDifficulty.ADAPTIVE,
    onQuizDifficultyChange: (QuizDifficulty) -> Unit = {},
    // Theme
    appTheme: AppTheme = AppTheme.DEEP_SPACE,
    onThemeChange: (AppTheme) -> Unit = {}
) {
    var showLogoutDialog by remember { mutableStateOf(false) }
    var showDifficultyDialog by remember { mutableStateOf(false) }

    // ── Logout dialog ─────────────────────────────────────────────────────────
    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            containerColor = AppColors.surfaceCard,
            shape = RoundedCornerShape(20.dp),
            icon = {
                Box(
                    modifier = Modifier.size(52.dp).background(Coral500.copy(alpha = 0.15f), CircleShape),
                    contentAlignment = Alignment.Center
                ) { Icon(Icons.Default.ExitToApp, null, tint = Coral500, modifier = Modifier.size(26.dp)) }
            },
            title = { Text("Sign Out?", color = TextWhite, fontWeight = FontWeight.Bold, fontSize = 18.sp) },
            text = { Text("You will need to sign in again to access your learning progress.", color = TextMuted, fontSize = 14.sp) },
            confirmButton = {
                Button(
                    onClick = { showLogoutDialog = false; onLogout() },
                    colors = ButtonDefaults.buttonColors(containerColor = Coral500),
                    shape = RoundedCornerShape(10.dp)
                ) { Text("Sign Out", fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { showLogoutDialog = false },
                    shape = RoundedCornerShape(10.dp),
                    border = ButtonDefaults.outlinedButtonBorder.copy(
                        brush = Brush.linearGradient(listOf(Color(0xFF2A2A5A), Color(0xFF2A2A5A)))
                    )
                ) { Text("Cancel", color = TextMuted) }
            }
        )
    }

    // ── Quiz difficulty dialog ────────────────────────────────────────────────
    if (showDifficultyDialog) {
        AlertDialog(
            onDismissRequest = { showDifficultyDialog = false },
            containerColor = AppColors.surfaceCard,
            shape = RoundedCornerShape(20.dp),
            title = { Text("Quiz Difficulty", color = TextWhite, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    QuizDifficulty.entries.forEach { diff ->
                        val selected = diff == quizDifficulty
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onQuizDifficultyChange(diff); showDifficultyDialog = false }
                                .padding(vertical = 10.dp, horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = selected,
                                onClick = { onQuizDifficultyChange(diff); showDifficultyDialog = false },
                                colors = RadioButtonDefaults.colors(selectedColor = Amber500, unselectedColor = TextMuted)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(diff.label, color = if (selected) Amber500 else TextWhite, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                                Text(
                                    when (diff) {
                                        QuizDifficulty.ADAPTIVE -> "Adjusts to your performance"
                                        QuizDifficulty.EASY     -> "Basic recall questions"
                                        QuizDifficulty.MEDIUM   -> "Application & analysis"
                                        QuizDifficulty.HARD     -> "Evaluation & synthesis"
                                    },
                                    color = TextMuted, fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {}
        )
    }

    val bg       = AppColors.background
    val surface   = AppColors.surface
    val primary   = AppColors.primary
    val barStart  = AppColors.barStart
    val barEnd    = AppColors.barEnd

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(surface, bg)))
    ) {
        Box(
            modifier = Modifier.size(260.dp).align(Alignment.TopEnd).offset(x = 80.dp, y = (-40).dp)
                .background(Brush.radialGradient(listOf(primary.copy(alpha = 0.07f), Color.Transparent)), CircleShape)
        )

        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {

            // ── TOP BAR ──────────────────────────────────────────────
            Box(
                modifier = Modifier.fillMaxWidth()
                    .background(Brush.horizontalGradient(listOf(barStart, barEnd)))
                    .padding(horizontal = 8.dp, vertical = 8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .noRippleClickable { onBackClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier.size(36.dp).background(AppColors.surfaceInput, CircleShape),
                            contentAlignment = Alignment.Center
                        ) { Icon(Icons.Default.ArrowBack, null, tint = TextWhite, modifier = Modifier.size(18.dp)) }
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                    AppLogo()
                    Spacer(modifier = Modifier.width(10.dp))
                    Text("Settings", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .navigationBarsPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
            ) {
                Spacer(modifier = Modifier.height(16.dp))

                // ── PROFILE CARD ──────────────────────────────────────
                Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), color = AppColors.surfaceCard) {
                    Box {
                        Box(
                            modifier = Modifier.fillMaxWidth().height(4.dp)
                                .background(Brush.horizontalGradient(listOf(Amber400, Violet400, Cyan500)))
                        )
                        Column(modifier = Modifier.padding(top = 4.dp).padding(20.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                // Tappable avatar — shows photo or initial, camera icon overlay
                                Box(
                                    modifier = Modifier
                                        .size(72.dp)
                                        .clickable { onAvatarClick() },
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (userProfile.avatarUrl.isNotBlank()) {
                                        AsyncImage(
                                            model = userProfile.avatarUrl,
                                            contentDescription = "Profile picture",
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxSize().clip(CircleShape)
                                        )
                                    } else {
                                        Box(
                                            modifier = Modifier.fillMaxSize()
                                                .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                userProfile.name.firstOrNull()?.uppercase() ?: "U",
                                                fontSize = 30.sp, fontWeight = FontWeight.Black, color = AppColors.onPrimary
                                            )
                                        }
                                    }
                                    // Camera icon overlay
                                    Box(
                                        modifier = Modifier
                                            .size(24.dp)
                                            .align(Alignment.BottomEnd)
                                            .background(Amber500, CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        if (avatarUploadState is AvatarUploadState.Uploading) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(14.dp),
                                                color = AppColors.onPrimary,
                                                strokeWidth = 2.dp
                                            )
                                        } else {
                                            Icon(
                                                Icons.Default.CameraAlt, null,
                                                tint = AppColors.onPrimary,
                                                modifier = Modifier.size(14.dp)
                                            )
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.width(16.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        userProfile.name.ifBlank { "Student" },
                                        fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextWhite,
                                        maxLines = 1, overflow = TextOverflow.Ellipsis
                                    )
                                    Text(userProfile.email, fontSize = 13.sp, color = TextMuted,
                                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Surface(shape = RoundedCornerShape(20.dp), color = Amber500.copy(alpha = 0.15f)) {
                                        Text(
                                            userProfile.educationLevel.ifBlank { "Student" },
                                            fontSize = 11.sp, color = Amber500, fontWeight = FontWeight.SemiBold,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                        )
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(16.dp))
                            HorizontalDivider(color = AppColors.divider)
                            Spacer(modifier = Modifier.height(14.dp))
                            Row(modifier = Modifier.fillMaxWidth()) {
                                ProfileStatItem(Modifier.weight(1f), "District",
                                    userProfile.district.ifBlank { "—" }, Icons.Default.LocationOn, Cyan500)
                            }
                            Spacer(modifier = Modifier.height(10.dp))
                            Row(modifier = Modifier.fillMaxWidth()) {
                                ProfileStatItem(Modifier.weight(1f), "Messages",
                                    userProfile.totalMessages.toString(), Icons.Default.Chat, Amber500)
                                ProfileStatItem(Modifier.weight(1f), "Quizzes",
                                    userProfile.totalQuizzes.toString(), Icons.Default.Quiz, Cyan500)
                                ProfileStatItem(Modifier.weight(1f), "Documents",
                                    userProfile.totalDocuments.toString(), Icons.Default.Description, Violet400)
                            }
                            when {
                                userProfile.educationLevel == "University" && userProfile.course.isNotBlank() ->
                                    ProfileInfoItem(Icons.Default.School, "Course", userProfile.course, Amber500)
                                userProfile.educationLevel == "Professional" && userProfile.profession.isNotBlank() ->
                                    ProfileInfoItem(Icons.Default.Work, "Profession", userProfile.profession, Cyan500)
                                userProfile.educationLevel in listOf("S5", "S6") && userProfile.combination.isNotBlank() ->
                                    ProfileInfoItem(Icons.Default.MenuBook, "Combination", userProfile.combination, Violet400)
                            }
                            if (userProfile.school.isNotBlank()) {
                                Spacer(modifier = Modifier.height(6.dp))
                                ProfileInfoItem(Icons.Default.AccountBalance, "School", userProfile.school, Amber500)
                            }
                        }
                    }
                }


                // LOCATION
                SectionLabel("ðŸ“  Location & District")
                Spacer(modifier = Modifier.height(8.dp))
                SettingsCard {
                    SettingsToggle(
                        Icons.Default.MyLocation, Cyan500,
                        "Use My Location",
                        if (detectedDistrict != null) "Detected: $detectedDistrict"
                        else "Auto-detect your district from GPS",
                        locationEnabled, onLocationToggle
                    )
                    SettingsDivider()
                    var districtExpanded by remember { mutableStateOf(false) }
                    Row(
                        modifier = Modifier.fillMaxWidth()
                            .noRippleClickable { if (allDistricts.isNotEmpty()) districtExpanded = true }
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier.size(38.dp)
                                .background(Amber500.copy(alpha = 0.12f), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) { Icon(Icons.Default.LocationOn, null, tint = Amber500, modifier = Modifier.size(20.dp)) }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Change District", fontSize = 15.sp, color = TextWhite, fontWeight = FontWeight.Medium)
                            Text(
                                currentDistrict.ifBlank { "Tap to select your district" },
                                fontSize = 12.sp,
                                color = if (currentDistrict.isNotBlank()) Amber500 else TextMuted
                            )
                        }
                        Icon(Icons.Default.ChevronRight, null, tint = TextDisabled, modifier = Modifier.size(18.dp))
                    }
                    DropdownMenu(
                        expanded = districtExpanded,
                        onDismissRequest = { districtExpanded = false },
                        modifier = Modifier.background(AppColors.surfaceCard).heightIn(max = 300.dp)
                    ) {
                        allDistricts.forEach { d ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        d,
                                        color = if (d == currentDistrict) Amber500 else TextWhite,
                                        fontWeight = if (d == currentDistrict) FontWeight.Bold else FontWeight.Normal
                                    )
                                },
                                onClick = { onDistrictChange(d); districtExpanded = false }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                Spacer(modifier = Modifier.height(24.dp))

                // ── EDUCATION LEVEL ───────────────────────────────────
                SectionLabel("🎓  Education")
                Spacer(modifier = Modifier.height(8.dp))
                EducationChangeCard(
                    userProfile        = userProfile,
                    allEducationLevels = allEducationLevels,
                    onEducationChange  = onEducationChange
                )

                Spacer(modifier = Modifier.height(20.dp))

                Spacer(modifier = Modifier.height(24.dp))

                // ── THEME ─────────────────────────────────────────────
                SectionLabel("🎨  Appearance")
                Spacer(modifier = Modifier.height(8.dp))
                SettingsCard {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("App Theme", fontSize = 15.sp, color = TextWhite, fontWeight = FontWeight.Medium)
                        Text("Changes the colour scheme across the entire app", fontSize = 12.sp, color = TextMuted)
                        Spacer(modifier = Modifier.height(14.dp))
                        // Theme swatches grid
                        val themes = AppTheme.entries
                        val themeColors = mapOf(
                            AppTheme.DEEP_SPACE to listOf(Color(0xFF0F0F2E), Color(0xFFFFC107), Color(0xFF7C4DFF)),
                            AppTheme.MIDNIGHT   to listOf(Color(0xFF000000), Color(0xFFFFC107), Color(0xFF00E5FF)),
                            AppTheme.FOREST     to listOf(Color(0xFF050F05), Color(0xFF00E676), Color(0xFFFFC107)),
                            AppTheme.OCEAN      to listOf(Color(0xFF020D1A), Color(0xFF00E5FF), Color(0xFFFFC107)),
                            AppTheme.SUNSET     to listOf(Color(0xFF100500), Color(0xFFFF6B6B), Color(0xFFFFC107))
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            themes.forEach { theme ->
                                val isSelected = theme == appTheme
                                val colors = themeColors[theme]!!
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable { onThemeChange(theme) },
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(44.dp)
                                            .border(
                                                width = if (isSelected) 2.5.dp else 1.dp,
                                                color = if (isSelected) Amber500 else Color(0xFF2A2A5A),
                                                shape = RoundedCornerShape(12.dp)
                                            )
                                            .background(colors[0], RoundedCornerShape(12.dp))
                                    ) {
                                        // Mini accent dots
                                        Box(
                                            modifier = Modifier.size(12.dp).align(Alignment.BottomStart)
                                                .offset(x = 4.dp, y = (-4).dp)
                                                .background(colors[1], CircleShape)
                                        )
                                        Box(
                                            modifier = Modifier.size(8.dp).align(Alignment.TopEnd)
                                                .offset(x = (-4).dp, y = 4.dp)
                                                .background(colors[2], CircleShape)
                                        )
                                        if (isSelected) {
                                            Icon(
                                                Icons.Default.Check, null,
                                                tint = Amber500,
                                                modifier = Modifier.size(16.dp).align(Alignment.Center)
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        theme.label.split(" ").first(),
                                        fontSize = 9.sp,
                                        color = if (isSelected) Amber500 else TextMuted,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // ── VOICE & AUDIO ─────────────────────────────────────
                SectionLabel("🎙️  Voice & Audio")
                Spacer(modifier = Modifier.height(8.dp))
                SettingsCard {
                    SettingsToggle(Icons.Default.Mic, Amber500,
                        "Voice Input", "Speak your questions to the AI",
                        voiceEnabled, onVoiceToggle)
                    SettingsDivider()
                    SettingsToggle(Icons.Default.VolumeUp, Cyan500,
                        "Auto-Read Responses", "AI reads answers aloud automatically",
                        autoReadEnabled, onAutoReadToggle)
                    SettingsDivider()
                    // Speech rate slider
                    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier.size(38.dp).background(Lime500.copy(alpha = 0.12f), RoundedCornerShape(10.dp)),
                                contentAlignment = Alignment.Center
                            ) { Icon(Icons.Default.Speed, null, tint = Lime500, modifier = Modifier.size(20.dp)) }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column(modifier = Modifier.weight(1f)) {
                            Text("Reading Speed", fontSize = 15.sp, color = AppColors.textPrimary, fontWeight = FontWeight.Medium)
                                Text(
                                    when {
                                        speechRate <= 0.6f -> "Very Slow"
                                        speechRate <= 0.85f -> "Slow"
                                        speechRate <= 1.15f -> "Normal"
                                        speechRate <= 1.5f -> "Fast"
                                        else -> "Very Fast"
                                    },
                                    fontSize = 12.sp, color = Lime500
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Slider(
                            value = speechRate,
                            onValueChange = onSpeechRateChange,
                            valueRange = 0.5f..2.0f,
                            steps = 5,
                            colors = SliderDefaults.colors(
                                thumbColor = Lime500,
                                activeTrackColor = Lime500,
                                inactiveTrackColor = AppColors.surfaceInput
                            )
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("0.5x", fontSize = 10.sp, color = AppColors.textDisabled)
                            Text("2.0x", fontSize = 10.sp, color = AppColors.textDisabled)
                        }
                    }
                    SettingsDivider()
                    // Voice gender toggle
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier.size(38.dp).background(Violet400.copy(alpha = 0.12f), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) { Icon(Icons.Default.RecordVoiceOver, null, tint = Violet400, modifier = Modifier.size(20.dp)) }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Voice Gender", fontSize = 15.sp, color = AppColors.textPrimary, fontWeight = FontWeight.Medium)
                            Text(if (voiceGenderMale) "Male voice" else "Female voice", fontSize = 12.sp, color = AppColors.textMuted)
                        }
                        Row(
                            modifier = Modifier
                                .background(AppColors.surfaceInput, RoundedCornerShape(20.dp))
                                .padding(4.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            listOf(false to "Female", true to "Male").forEach { (isMale, label) ->
                                val selected = voiceGenderMale == isMale
                                Box(
                                    modifier = Modifier
                                        .background(
                                            if (selected) Violet400 else Color.Transparent,
                                            RoundedCornerShape(16.dp)
                                        )
                                        .noRippleClickable { onVoiceGenderChange(isMale) }
                                        .padding(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text(
                                        label,
                                        fontSize = 12.sp,
                                        color = if (selected) TextWhite else AppColors.textMuted,
                                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                                    )
                                }
                            }
                        }
                    }
                    SettingsDivider()
                    SettingsToggle(Icons.Default.MusicNote, Violet400,
                        "Quiz Sound Effects", "Play sounds on correct/wrong answers",
                        quizSoundEnabled, onQuizSoundToggle)
                }

                Spacer(modifier = Modifier.height(20.dp))

                // ── NOTIFICATIONS ─────────────────────────────────────
                SectionLabel("🔔  Notifications")
                Spacer(modifier = Modifier.height(8.dp))
                SettingsCard {
                    SettingsToggle(Icons.Default.Notifications, Amber500,
                        "Push Notifications", "Get updates and announcements",
                        notificationsEnabled, onNotificationsToggle)
                    SettingsDivider()
                    SettingsToggle(Icons.Default.Schedule, Cyan500,
                        "Study Reminders", "Daily reminders to keep learning",
                        studyRemindersEnabled, onStudyRemindersToggle)
                }

                Spacer(modifier = Modifier.height(20.dp))

                // ── LEARNING ──────────────────────────────────────────
                SectionLabel("📚  Learning")
                Spacer(modifier = Modifier.height(8.dp))
                SettingsCard {
                    SettingsNavItem(
                        Icons.Default.Quiz, Amber500,
                        "Quiz Difficulty", quizDifficulty.label,
                        onClick = { showDifficultyDialog = true }
                    )
                    SettingsDivider()
                    SettingsNavItem(Icons.Default.Language, Cyan500, "Language", "English", {})
                    SettingsDivider()
                    SettingsNavItem(Icons.Default.BarChart, Violet400, "Learning Progress", "View your stats and achievements", onLearningProgressClick)
                    SettingsDivider()
                    SettingsNavItem(Icons.Default.CalendarMonth, Amber500, "Study Timetable", "Schedule your weekly study sessions", onTimetableClick)
                    SettingsDivider()
                    SettingsNavItem(Icons.Default.CloudDownload, Lime500, "Offline Mode", "Coming soon", {}, badge = "Soon")
                }

                Spacer(modifier = Modifier.height(20.dp))

                // ── ABOUT ─────────────────────────────────────────────
                SectionLabel("ℹ️  About")
                Spacer(modifier = Modifier.height(8.dp))
                SettingsCard {
                    SettingsNavItem(Icons.Default.Info, Cyan500, "App Version", "TutorUG v1.0.0", {})
                    SettingsDivider()
                    SettingsNavItem(Icons.Default.Shield, Amber500, "Privacy Policy", "How we protect your data", onPrivacyPolicyClick)
                    SettingsDivider()
                    SettingsNavItem(Icons.Default.Description, Violet400, "Terms of Service", "Usage terms and conditions", onTermsClick)
                    SettingsDivider()
                    SettingsNavItem(Icons.Default.Star, Amber500, "Rate TutorUG", "Help us improve with your feedback", {})
                    SettingsDivider()
                    SettingsNavItem(Icons.Default.Share, Cyan500, "Share with Friends", "Invite fellow students to TutorUG", onShareClick)
                }

                Spacer(modifier = Modifier.height(20.dp))

                // ── ACCOUNT ───────────────────────────────────────────
                SectionLabel("⚠️  Account")
                Spacer(modifier = Modifier.height(8.dp))
                SettingsCard {
                    SettingsNavItem(Icons.Default.Lock, TextMuted, "Change Password", "Update your account password", onChangePasswordClick)
                    SettingsDivider()
                    Row(
                        modifier = Modifier.fillMaxWidth().noRippleClickable { showLogoutDialog = true }.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier.size(38.dp).background(Coral500.copy(alpha = 0.15f), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) { Icon(Icons.Default.ExitToApp, null, tint = Coral500, modifier = Modifier.size(20.dp)) }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Sign Out", fontSize = 15.sp, color = Coral500, fontWeight = FontWeight.SemiBold)
                            Text("Sign out of your account", fontSize = 12.sp, color = AppColors.textMuted)
                        }
                        Icon(Icons.Default.ChevronRight, null, tint = Coral500.copy(alpha = 0.5f), modifier = Modifier.size(18.dp))
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text("TutorUG • Uganda's Smart Learning Companion 🇺🇬",
                    fontSize = 12.sp, color = TextDisabled,
                    modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                Text("Made with ❤️ for Ugandan Students",
                    fontSize = 11.sp, color = TextDisabled,
                    modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)

                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

// ── REUSABLE COMPONENTS ───────────────────────────────────────────────────────

@Composable
private fun SectionLabel(title: String) {
    Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = AppColors.textMuted,
        modifier = Modifier.padding(horizontal = 4.dp))
}

@Composable
private fun SettingsCard(content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), color = AppColors.surfaceCard) {
        Column(content = content)
    }
}

@Composable
private fun SettingsDivider() {
    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp), color = AppColors.divider)
}

@Composable
private fun SettingsToggle(
    icon: ImageVector, iconColor: Color,
    title: String, subtitle: String,
    checked: Boolean, onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth().noRippleClickable { onCheckedChange(!checked) }.padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.size(38.dp).background(iconColor.copy(alpha = 0.12f), RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center
        ) { Icon(icon, null, tint = iconColor, modifier = Modifier.size(20.dp)) }
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 15.sp, color = AppColors.textPrimary, fontWeight = FontWeight.Medium)
            Text(subtitle, fontSize = 12.sp, color = AppColors.textMuted)
        }
        Switch(
            checked = checked, onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor   = AppColors.onPrimary,
                checkedTrackColor   = AppColors.primary,
                uncheckedThumbColor = AppColors.textMuted,
                uncheckedTrackColor = AppColors.surfaceInput
            )
        )
    }
}

@Composable
private fun SettingsNavItem(
    icon: ImageVector, iconColor: Color,
    title: String, subtitle: String,
    onClick: () -> Unit, badge: String? = null
) {
    Row(
        modifier = Modifier.fillMaxWidth().noRippleClickable(onClick = onClick).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.size(38.dp).background(iconColor.copy(alpha = 0.12f), RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center
        ) { Icon(icon, null, tint = iconColor, modifier = Modifier.size(20.dp)) }
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 15.sp, color = AppColors.textPrimary, fontWeight = FontWeight.Medium)
            Text(subtitle, fontSize = 12.sp, color = AppColors.textMuted)
        }
        if (badge != null) {
            Surface(shape = RoundedCornerShape(20.dp), color = Cyan500.copy(alpha = 0.15f)) {
                Text(badge, fontSize = 10.sp, color = Cyan500, fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
            }
        } else {
            Icon(Icons.Default.ChevronRight, null, tint = AppColors.textDisabled, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun ProfileStatItem(
    modifier: Modifier = Modifier,
    label: String, value: String,
    icon: ImageVector, iconColor: Color
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = iconColor, modifier = Modifier.size(14.dp))
        Spacer(modifier = Modifier.width(6.dp))
        Column {
            Text(label, fontSize = 10.sp, color = AppColors.textMuted)
            Text(value, fontSize = 13.sp, color = AppColors.textPrimary, fontWeight = FontWeight.Medium,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun ProfileInfoItem(icon: ImageVector, label: String, value: String, iconColor: Color) {
    Spacer(modifier = Modifier.height(8.dp))
    Row(
        modifier = Modifier.fillMaxWidth()
            .background(AppColors.surfaceInput.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = iconColor, modifier = Modifier.size(16.dp))
        Spacer(modifier = Modifier.width(10.dp))
        Text("$label: ", fontSize = 12.sp, color = AppColors.textMuted)
        Text(value, fontSize = 13.sp, color = AppColors.textPrimary, fontWeight = FontWeight.Medium,
            maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EducationChangeCard(
    userProfile: UserProfile,
    allEducationLevels: List<String>,
    onEducationChange: (level: String, school: String, combination: String, course: String, profession: String) -> Unit
) {
    var selectedLevel  by remember(userProfile.educationLevel) { mutableStateOf(userProfile.educationLevel) }
    var school         by remember(userProfile.school)         { mutableStateOf(userProfile.school) }
    var combination    by remember(userProfile.combination)    { mutableStateOf(userProfile.combination) }
    var course         by remember(userProfile.course)         { mutableStateOf(userProfile.course) }
    var profession     by remember(userProfile.profession)     { mutableStateOf(userProfile.profession) }
    var levelExpanded  by remember { mutableStateOf(false) }
    var saved          by remember { mutableStateOf(false) }

    val isALevel       = selectedLevel in listOf("S5", "S6")
    val isUniversity   = selectedLevel == "University"
    val isProfessional = selectedLevel == "Professional"
    val showSchool     = !isUniversity && !isProfessional

    val hasChanged = selectedLevel != userProfile.educationLevel ||
        school != userProfile.school ||
        combination != userProfile.combination ||
        course != userProfile.course ||
        profession != userProfile.profession

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor        = AppColors.textPrimary,
        unfocusedTextColor      = AppColors.textPrimary,
        focusedBorderColor      = Amber500,
        unfocusedBorderColor    = AppColors.outline,
        focusedContainerColor   = AppColors.surfaceInput,
        unfocusedContainerColor = AppColors.surfaceInput,
        cursorColor             = Amber500,
        focusedLabelColor       = Amber500,
        unfocusedLabelColor     = AppColors.textMuted
    )

    Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), color = AppColors.surfaceCard) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {

            // Current level badge
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.School, null, tint = Amber500, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Current: ", fontSize = 13.sp, color = AppColors.textMuted)
                Surface(shape = RoundedCornerShape(20.dp), color = Amber500.copy(alpha = 0.15f)) {
                    Text(
                        userProfile.educationLevel.ifBlank { "Not set" },
                        fontSize = 12.sp, color = Amber500, fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp)
                    )
                }
            }

            // Level dropdown
            Box {
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .background(AppColors.surfaceInput, RoundedCornerShape(10.dp))
                        .border(1.dp, if (selectedLevel != userProfile.educationLevel) Amber500 else AppColors.outline, RoundedCornerShape(10.dp))
                        .noRippleClickable { levelExpanded = true }
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        selectedLevel.ifBlank { "Select new level…" },
                        modifier = Modifier.weight(1f),
                        color = if (selectedLevel.isBlank()) AppColors.textDisabled else AppColors.textPrimary,
                        fontSize = 14.sp, fontWeight = FontWeight.Medium
                    )
                    Icon(Icons.Default.ArrowDropDown, null, tint = Amber500)
                }
                DropdownMenu(
                    expanded = levelExpanded,
                    onDismissRequest = { levelExpanded = false },
                    modifier = Modifier.background(AppColors.surfaceCard).heightIn(max = 260.dp)
                ) {
                    allEducationLevels.forEach { level ->
                        DropdownMenuItem(
                            text = {
                                Text(
                                    level,
                                    color = if (level == selectedLevel) Amber500 else AppColors.textPrimary,
                                    fontWeight = if (level == selectedLevel) FontWeight.Bold else FontWeight.Normal,
                                    fontSize = 14.sp
                                )
                            },
                            onClick = {
                                selectedLevel = level
                                // Reset level-specific fields when level changes
                                combination = ""
                                course = ""
                                profession = ""
                                school = ""
                                saved = false
                                levelExpanded = false
                            }
                        )
                    }
                }
            }

            // Conditional extra fields
            if (isALevel) {
                OutlinedTextField(
                    value = combination, onValueChange = { combination = it; saved = false },
                    label = { Text("Subject Combination (e.g. PCB, HEG)") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = fieldColors, singleLine = true, shape = RoundedCornerShape(10.dp)
                )
            }
            if (isUniversity) {
                OutlinedTextField(
                    value = course, onValueChange = { course = it; saved = false },
                    label = { Text("University Course") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = fieldColors, singleLine = true, shape = RoundedCornerShape(10.dp)
                )
            }
            if (isProfessional) {
                OutlinedTextField(
                    value = profession, onValueChange = { profession = it; saved = false },
                    label = { Text("Your Profession") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = fieldColors, singleLine = true, shape = RoundedCornerShape(10.dp)
                )
            }
            if (showSchool) {
                OutlinedTextField(
                    value = school, onValueChange = { school = it; saved = false },
                    label = { Text("School (Optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = fieldColors, singleLine = true, shape = RoundedCornerShape(10.dp)
                )
            }

            // Info note
            if (hasChanged) {
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .background(Amber500.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Info, null, tint = Amber500, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "Changing your level updates your subjects, AI tutor context and timetable subjects.",
                        fontSize = 11.sp, color = AppColors.textMuted
                    )
                }
            }

            // Save button
            Button(
                onClick = {
                    onEducationChange(selectedLevel, school, combination, course, profession)
                    saved = true
                },
                enabled = hasChanged,
                modifier = Modifier.fillMaxWidth().height(46.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Amber500,
                    disabledContainerColor = AppColors.surfaceInput
                ),
                shape = RoundedCornerShape(10.dp)
            ) {
                if (saved) {
                    Icon(Icons.Default.Check, null, tint = Color.Black, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Saved!", color = Color.Black, fontWeight = FontWeight.Bold)
                } else {
                    Text(
                        if (hasChanged) "Save Changes" else "No Changes",
                        color = if (hasChanged) Color.Black else AppColors.textMuted,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
