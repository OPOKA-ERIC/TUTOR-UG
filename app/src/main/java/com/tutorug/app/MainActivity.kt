package com.tutorug.app

import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.speech.RecognizerIntent
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.tutorug.app.ui.screens.*
import com.tutorug.app.ui.theme.TutorUGTheme
import com.tutorug.app.viewmodel.*
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1001)
        }
        setContent {
            TutorUGRoot(intent)
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}

@Composable
fun TutorUGRoot(intent: android.content.Intent? = null) {
    val settingsViewModel: SettingsViewModel = viewModel()
    val appTheme by settingsViewModel.appTheme.collectAsState()

    TutorUGTheme(appTheme = appTheme) {
        Surface(modifier = Modifier.fillMaxSize()) {
            TutorUGNavigation(settingsViewModel, intent)
        }
    }
}

@Composable
fun TutorUGNavigation(settingsViewModel: SettingsViewModel, intent: android.content.Intent? = null) {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = viewModel()
    val chatViewModel: ChatViewModel = viewModel()
    val documentViewModel: DocumentViewModel = viewModel()
    val quizViewModel: QuizViewModel = viewModel()
    val timetableViewModel: TimetableViewModel = viewModel()
    val context = androidx.compose.ui.platform.LocalContext.current

    // Handle deep link from password reset email
    LaunchedEffect(intent) {
        val data = intent?.data
        if (data?.scheme == "tutorug" && data.host == "reset-password") {
            // Legacy deep link — no longer used, OTP flow handles reset
        }
    }

    val authState by authViewModel.authState.collectAsState()
    val autoReadEnabled by settingsViewModel.autoReadEnabled.collectAsState()
    val voiceEnabled by settingsViewModel.voiceEnabled.collectAsState()

    // Track app foreground/background for study session attendance
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            val userId = (authState as? AuthState.Authenticated)?.profile?.userId ?: return@LifecycleEventObserver
            when (event) {
                androidx.lifecycle.Lifecycle.Event.ON_RESUME -> timetableViewModel.onAppResumed(userId)
                androidx.lifecycle.Lifecycle.Event.ON_PAUSE  -> timetableViewModel.onAppPaused(userId)
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Keep chatViewModel in sync with autoRead setting
    LaunchedEffect(autoReadEnabled) {
        chatViewModel.autoReadEnabled = autoReadEnabled
    }

    // Sync persisted speech rate and gender to VoiceManager on startup
    val speechRate by settingsViewModel.speechRate.collectAsState()
    val voiceGender by settingsViewModel.voiceGender.collectAsState()
    LaunchedEffect(speechRate) {
        chatViewModel.voiceManager.setSpeechRate(speechRate)
    }
    LaunchedEffect(voiceGender) {
        chatViewModel.voiceManager.setVoiceMale(voiceGender == VoiceGender.MALE)
    }

    // Track the last loaded userId so we only reset on actual user change
    var lastLoadedUserId by remember { mutableStateOf<String?>(null) }

    // Load settings from DB whenever user authenticates
    LaunchedEffect(authState) {
        if (authState is AuthState.Authenticated) {
            val profile = (authState as AuthState.Authenticated).profile
            if (lastLoadedUserId != profile.userId) {
                lastLoadedUserId = profile.userId
                chatViewModel.clearAllData()
                settingsViewModel.loadFromDb(profile.userId)
                chatViewModel.loadChatHistory(profile.userId)
            }
        } else if (authState is AuthState.Idle) {
            lastLoadedUserId = null
            chatViewModel.clearAllData()
        }
    }

    val speechLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val spokenText = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.get(0)
            if (spokenText != null && authState is AuthState.Authenticated) {
                val profile = (authState as AuthState.Authenticated).profile
                // In learning mode pass the section-complete callback so voice can also trigger quiz
                if (chatViewModel.isLearningMode()) {
                    chatViewModel.sendMessage(spokenText, profile) {
                        val sections = chatViewModel.learningSections.value
                        val idx = chatViewModel.currentSectionIndex.value
                        val section = sections.getOrNull(idx)
                        if (section != null) {
                            quizViewModel.resetAndGenerate(
                                sectionContent  = section.content,
                                userProfile     = profile,
                                districtContext = "Student: ${profile.name}, District: ${profile.district}"
                            )
                        }
                        navController.navigate("sectionquiz")
                    }
                } else {
                    chatViewModel.sendMessage(spokenText, profile)
                }
            }
        }
    }

    NavHost(navController = navController, startDestination = "splash") {

        composable("splash") {
            SplashScreen(
                onNavigateToAuth = {
                    if (authState is AuthState.Authenticated) {
                        navController.navigate("chat") { popUpTo("splash") { inclusive = true } }
                    } else {
                        navController.navigate("login") { popUpTo("splash") { inclusive = true } }
                    }
                }
            )
        }

        composable("login") {
            LoginScreen(
                viewModel = authViewModel,
                onLoginSuccess = {
                    navController.navigate("chat") { popUpTo("login") { inclusive = true } }
                },
                onRegisterClick = { navController.navigate("register") },
                onForgotPasswordClick = { navController.navigate("forgotpassword") }
            )
        }

        composable("forgotpassword") {
            ForgotPasswordScreen(
                onBackClick = { navController.popBackStack() },
                onOtpSent = { email ->
                    navController.navigate("verifyotp/${email}")
                },
                onSendOtp = { email, callback -> authViewModel.sendOtp(email, callback) }
            )
        }

        composable("verifyotp/{email}") { backStackEntry ->
            val email = backStackEntry.arguments?.getString("email") ?: ""
            OtpVerifyScreen(
                email = email,
                onBackClick = { navController.popBackStack() },
                onVerified = { navController.navigate("newpassword/${email}") { popUpTo("verifyotp/{email}") { inclusive = true } } },
                onResendOtp = { e, callback -> authViewModel.sendOtp(e, callback) },
                onVerifyOtp = { e, otp, callback -> authViewModel.verifyOtp(e, otp, callback) }
            )
        }

        composable("newpassword/{email}") { backStackEntry ->
            val email = backStackEntry.arguments?.getString("email") ?: ""
            NewPasswordScreen(
                email = email,
                onBackClick = { navController.popBackStack() },
                onPasswordReset = { e, pwd, callback -> authViewModel.resetPasswordWithEmail(e, pwd, callback) },
                onSuccess = {
                    navController.navigate("login") { popUpTo(0) { inclusive = true } }
                }
            )
        }

        composable("register") {
            RegisterScreen(
                viewModel = authViewModel,
                onRegisterSuccess = {
                    authViewModel.resetToIdle()
                    navController.navigate("login") { popUpTo("register") { inclusive = true } }
                },
                onLoginClick = { navController.popBackStack() }
            )
        }

        composable("chat") {
            val profile = (authState as? AuthState.Authenticated)?.profile
            if (profile != null) {
                val messages by chatViewModel.messages.collectAsState()
                val chatState by chatViewModel.chatState.collectAsState()
                val currentSession by chatViewModel.currentSession.collectAsState()
                val chatHistory by chatViewModel.chatHistory.collectAsState()
                val learningHistory by chatViewModel.learningHistory.collectAsState()
                val streamingText by chatViewModel.streamingText.collectAsState()

                LaunchedEffect(profile.userId) {
                    chatViewModel.loadChatHistory(profile.userId)
                }
                // Only init chat once — not on every back navigation
                LaunchedEffect(Unit) {
                    chatViewModel.initChat(profile)
                }

                if (chatState is ChatState.Error) {
                    LaunchedEffect(chatState) {
                        kotlinx.coroutines.delay(3000)
                        chatViewModel.dismissError()
                    }
                }

                ChatScreen(
                    userProfile = profile,
                    messages = messages,
                    chatHistory = chatHistory + learningHistory,
                    currentSubject = currentSession?.subject ?: "",
                    isLoading = chatState is ChatState.Loading,
                isStreaming = chatState is ChatState.Streaming,
                streamingText = streamingText,
                    errorMessage = if (chatState is ChatState.Error) (chatState as ChatState.Error).message else null,
                    onSendMessage = { chatViewModel.sendMessage(it, profile) },
                    onVoiceInput = {
                        if (voiceEnabled) chatViewModel.voiceManager.startSpeechRecognition(speechLauncher)
                    },
                    onFileSelected = { uri, fileName, messageText ->
                        chatViewModel.uploadAndStartLearning(uri, fileName, messageText, profile) {
                            navController.navigate("learn")
                        }
                    },
                    onSubjectSelect = { subject ->
                        chatViewModel.startNewChatWithIntro(subject, profile)
                    },
                    onSessionSelect = { sessionId ->
                        val allSessions = chatViewModel.chatHistory.value + chatViewModel.learningHistory.value
                        val session = allSessions.find { it.sessionId == sessionId }
                        if (session?.documentId != null) {
                            chatViewModel.resumeLearning(session, profile) {
                                navController.navigate("learn")
                            }
                        } else if (session != null && session.documentId == null) {
                            // Could be a learning session whose documentId wasn't loaded in the
                            // in-memory list — fetch full session from DB to be sure
                            chatViewModel.selectOrResumeLearning(
                                sessionId = sessionId,
                                userId = profile.userId,
                                userProfile = profile,
                                onNavigateToLearn = { navController.navigate("learn") }
                            )
                        } else {
                            chatViewModel.selectSession(sessionId, profile.userId)
                        }
                    },
                    onDeleteSession = { chatViewModel.deleteSession(it, profile.userId) },
                    onEditMessage = { index, newText ->
                        chatViewModel.editAndResend(index, newText, profile)
                    },
                    onNewChat = {
                        chatViewModel.startNewChat(
                            profile.userId,
                            when {
                                profile.educationLevel == "University"   -> profile.course.ifBlank { "General" }
                                profile.educationLevel == "Professional" -> profile.profession.ifBlank { "General" }
                                else -> "General"
                            },
                            profile.educationLevel
                        )
                    },
                    onSettingsClick = { navController.navigate("settings") },
                    onTimetableClick = { navController.navigate("timetable") },
                    onLogout = {
                        chatViewModel.clearAllData()
                        authViewModel.logout()
                        navController.navigate("login") { popUpTo(0) { inclusive = true } }
                    }
                )
            } else {
                LaunchedEffect(Unit) {
                    navController.navigate("login") { popUpTo(0) { inclusive = true } }
                }
            }
        }

        composable("settings") {
            val profile = (authState as? AuthState.Authenticated)?.profile
            if (profile != null) {
                val voiceEnabledS       by settingsViewModel.voiceEnabled.collectAsState()
                val autoReadEnabledS    by settingsViewModel.autoReadEnabled.collectAsState()
                val quizSoundEnabledS   by settingsViewModel.quizSoundEnabled.collectAsState()
                val notificationsS      by settingsViewModel.notificationsEnabled.collectAsState()
                val studyRemindersS     by settingsViewModel.studyRemindersEnabled.collectAsState()
                val quizDifficultyS     by settingsViewModel.quizDifficulty.collectAsState()
                val appThemeS           by settingsViewModel.appTheme.collectAsState()
                val avatarUploadState   by settingsViewModel.avatarUploadState.collectAsState()
                val locationEnabledS    by settingsViewModel.locationEnabled.collectAsState()
                val detectedDistrictS   by settingsViewModel.detectedDistrict.collectAsState()
                val allDistricts        = authViewModel.districts.collectAsState().value
                val allEducationLevels  = authViewModel.educationLevels.collectAsState().value
                val speechRateS         by settingsViewModel.speechRate.collectAsState()
                val voiceGenderS        by settingsViewModel.voiceGender.collectAsState()

                // Location permission launcher
                val locationLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestMultiplePermissions()
                ) { perms ->
                    val granted = perms[android.Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                                  perms[android.Manifest.permission.ACCESS_COARSE_LOCATION] == true
                    if (granted) {
                        settingsViewModel.setLocationEnabled(true)
                        // Get last known location and resolve to district
                        try {
                            val lm = context.getSystemService(android.content.Context.LOCATION_SERVICE)
                                as android.location.LocationManager
                            val loc = lm.getLastKnownLocation(android.location.LocationManager.GPS_PROVIDER)
                                ?: lm.getLastKnownLocation(android.location.LocationManager.NETWORK_PROVIDER)
                            if (loc != null) {
                                settingsViewModel.resolveLocationToDistrict(loc.latitude, loc.longitude) { district, region ->
                                    authViewModel.updateDistrict(profile.userId, district, region)
                                }
                            }
                        } catch (_: SecurityException) {}
                    } else {
                        settingsViewModel.setLocationEnabled(false)
                    }
                }

                LaunchedEffect(Unit) { authViewModel.refreshProfile(profile.userId) }

                LaunchedEffect(avatarUploadState) {
                    if (avatarUploadState is AvatarUploadState.Success) {
                        authViewModel.refreshProfile(profile.userId)
                        settingsViewModel.resetAvatarState()
                    }
                }

                val avatarPickerLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.GetContent()
                ) { uri ->
                    uri?.let { settingsViewModel.uploadAvatar(profile.userId, it) { } }
                }

                SettingsScreen(
                    userProfile          = profile,
                    onBackClick          = { navController.popBackStack() },
                    onLogout             = {
                        chatViewModel.clearAllData()
                        authViewModel.logout()
                        navController.navigate("login") { popUpTo(0) { inclusive = true } }
                    },
                    onAvatarClick        = { avatarPickerLauncher.launch("image/*") },
                    onLearningProgressClick = { navController.navigate("progress") },
                    onTimetableClick = { navController.navigate("timetable") },
                    onPrivacyPolicyClick = { navController.navigate("privacy") },
                    onTermsClick         = { navController.navigate("terms") },
                    onChangePasswordClick = { navController.navigate("changepassword") },
                    onShareClick         = {
                        val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(android.content.Intent.EXTRA_SUBJECT, "TutorUG — Uganda's Smart Learning Companion")
                            putExtra(android.content.Intent.EXTRA_TEXT,
                                "Hey! I'm using TutorUG, an AI-powered tutor built for Ugandan students. " +
                                "It helps with all subjects from Primary to University level with localised Ugandan content. " +
                                "Download it and start learning smarter! \uD83C\uDDFA\uD83C\uDDEC\n\ninfo@tutorug.com")
                        }
                        context.startActivity(android.content.Intent.createChooser(intent, "Share TutorUG"))
                    },
                    avatarUploadState    = avatarUploadState,
                    locationEnabled      = locationEnabledS,
                    onLocationToggle     = { enable ->
                        if (enable) {
                            locationLauncher.launch(arrayOf(
                                android.Manifest.permission.ACCESS_FINE_LOCATION,
                                android.Manifest.permission.ACCESS_COARSE_LOCATION
                            ))
                        } else {
                            settingsViewModel.setLocationEnabled(false)
                        }
                    },
                    detectedDistrict     = detectedDistrictS,
                    allDistricts         = allDistricts,
                    currentDistrict      = profile.district,
                    onDistrictChange     = { district ->
                        authViewModel.updateDistrict(profile.userId, district, "")
                    },
                    allEducationLevels   = allEducationLevels,
                    onEducationChange    = { level, school, combination, course, profession ->
                        authViewModel.updateEducationProfile(profile.userId, level, school, combination, course, profession)
                    },
                    voiceEnabled         = voiceEnabledS,
                    onVoiceToggle        = { settingsViewModel.setVoiceEnabled(it) },
                    autoReadEnabled      = autoReadEnabledS,
                    onAutoReadToggle     = { settingsViewModel.setAutoReadEnabled(it) },
                    speechRate           = speechRateS,
                    onSpeechRateChange   = { rate ->
                        settingsViewModel.setSpeechRate(rate)
                        chatViewModel.voiceManager.setSpeechRate(rate)
                    },
                    voiceGenderMale      = voiceGenderS == VoiceGender.MALE,
                    onVoiceGenderChange  = { male ->
                        val gender = if (male) VoiceGender.MALE else VoiceGender.FEMALE
                        settingsViewModel.setVoiceGender(gender)
                        chatViewModel.voiceManager.setVoiceMale(male)
                    },
                    quizSoundEnabled     = quizSoundEnabledS,
                    onQuizSoundToggle    = { settingsViewModel.setQuizSoundEnabled(it) },
                    notificationsEnabled = notificationsS,
                    onNotificationsToggle = { settingsViewModel.setNotificationsEnabled(it) },
                    studyRemindersEnabled = studyRemindersS,
                    onStudyRemindersToggle = { settingsViewModel.setStudyRemindersEnabled(it) },
                    quizDifficulty       = quizDifficultyS,
                    onQuizDifficultyChange = { settingsViewModel.setQuizDifficulty(it) },
                    appTheme             = appThemeS,
                    onThemeChange        = { settingsViewModel.setAppTheme(it) }
                )
            }
        }

        composable("learn") {
            val profile = (authState as? AuthState.Authenticated)?.profile
            if (profile != null) {
                val sections        by chatViewModel.learningSections.collectAsState()
                val sectionIndex    by chatViewModel.currentSectionIndex.collectAsState()
                val messages        by chatViewModel.messages.collectAsState()
                val chatState       by chatViewModel.chatState.collectAsState()
                val streamingText   by chatViewModel.streamingText.collectAsState()
                val documentId      by chatViewModel.learningDocumentId.collectAsState()
                val quizDifficulty  by settingsViewModel.quizDifficulty.collectAsState()
                val allSectionsComplete by chatViewModel.allSectionsComplete.collectAsState()

                if (sections.isEmpty()) {
                    LaunchedEffect(Unit) { navController.popBackStack() }
                    return@composable
                }

                LearningScreen(
                    userProfile         = profile,
                    sections            = sections,
                    currentSectionIndex = sectionIndex,
                    messages            = messages,
                    isLoading           = chatState is ChatState.Loading,
                    isStreaming         = chatState is ChatState.Streaming,
                    streamingText       = streamingText,
                    allSectionsComplete = allSectionsComplete,
                    errorMessage        = if (chatState is ChatState.Error) (chatState as ChatState.Error).message else null,
                    onSendMessage       = { msg, completionCb -> chatViewModel.sendMessage(msg, profile, completionCb) },
                    onVoiceInput        = {
                        if (voiceEnabled) chatViewModel.voiceManager.startSpeechRecognition(speechLauncher)
                    },
                    onSectionComplete   = {
                        val section = sections.getOrNull(sectionIndex)
                        if (section != null) {
                            quizViewModel.resetAndGenerate(
                                sectionContent  = section.content,
                                userProfile     = profile,
                                districtContext = "Student: ${profile.name}, District: ${profile.district}"
                            )
                        }
                        navController.navigate("sectionquiz")
                    },
                    onBackClick = {
                        // Save current section index to DB before leaving
                        val sessionId = chatViewModel.currentSession.value?.sessionId
                        val sectionIdx = chatViewModel.currentSectionIndex.value
                        if (sessionId != null) {
                            chatViewModel.saveSectionIndexOnExit(sessionId, sectionIdx)
                        }
                        chatViewModel.clearLearningMode()
                        navController.navigate("chat") {
                            popUpTo("chat") { inclusive = false }
                        }
                    }
                )
            }
        }

        composable("sectionquiz") {
            val profile         = (authState as? AuthState.Authenticated)?.profile
            val questions       by quizViewModel.questions.collectAsState()
            val quizState       by quizViewModel.quizState.collectAsState()
            val quizSoundEnabled by settingsViewModel.quizSoundEnabled.collectAsState()
            val quizDifficulty  by settingsViewModel.quizDifficulty.collectAsState()
            val sections        by chatViewModel.learningSections.collectAsState()
            val sectionIndex    by chatViewModel.currentSectionIndex.collectAsState()
            val documentId      by chatViewModel.learningDocumentId.collectAsState()
            val currentSection  = sections.getOrNull(sectionIndex)

            LaunchedEffect(profile?.userId) {
                profile?.userId?.let { quizViewModel.loadQuizResults(it) }
            }

            val score = quizViewModel.calculateScore()
            val showResults = quizState is QuizState.Idle && questions.isNotEmpty()

            QuizScreen(
                sectionTitle    = currentSection?.title ?: "",
                currentSection  = sectionIndex + 1,
                totalSections   = sections.size,
                questions       = questions,
                isLoading       = quizState is QuizState.Loading,
                onAnswerSubmit  = { qIdx, aIdx -> quizViewModel.submitAnswer(qIdx, aIdx) },
                onFinishQuiz    = {
                    profile?.let { p ->
                        quizViewModel.saveResult(
                            userId         = p.userId,
                            documentId     = documentId,
                            sectionTitle   = currentSection?.title ?: "",
                            sectionIndex   = sectionIndex,
                            difficulty     = quizDifficulty.name.lowercase(),
                            subject        = currentSection?.title ?: "",
                            educationLevel = p.educationLevel,
                            onSectionProgressUpdate = { passed, score ->
                                chatViewModel.updateSectionProgress(documentId, sectionIndex, passed, score)
                            }
                        )
                    }
                },
                onNextSection   = {
                    val nextIndex = sectionIndex + 1
                    if (nextIndex < sections.size) {
                        profile?.let { chatViewModel.nextSection(it) }
                        navController.popBackStack()
                    } else {
                        // All sections complete — advance index past end to show completion card
                        profile?.let { chatViewModel.markAllSectionsComplete(it) }
                        navController.popBackStack()
                    }
                },
                onRetryQuiz     = {
                    profile?.let { p ->
                        quizViewModel.saveResult(
                            userId         = p.userId,
                            documentId     = documentId,
                            sectionTitle   = currentSection?.title ?: "",
                            sectionIndex   = sectionIndex,
                            difficulty     = quizDifficulty.name.lowercase(),
                            subject        = currentSection?.title ?: "",
                            educationLevel = p.educationLevel,
                            onSectionProgressUpdate = { passed, score ->
                                chatViewModel.updateSectionProgress(documentId, sectionIndex, passed, score)
                            }
                        )
                    }
                    val section = sections.getOrNull(sectionIndex)
                    if (section != null && profile != null) {
                        quizViewModel.resetAndGenerate(
                            sectionContent  = section.content,
                            userProfile     = profile,
                            districtContext = "Student: ${profile.name}, District: ${profile.district}"
                        )
                    }
                },
                onReExplain     = {
                    profile?.let { p ->
                        quizViewModel.saveResult(
                            userId         = p.userId,
                            documentId     = documentId,
                            sectionTitle   = currentSection?.title ?: "",
                            sectionIndex   = sectionIndex,
                            difficulty     = quizDifficulty.name.lowercase(),
                            subject        = currentSection?.title ?: "",
                            educationLevel = p.educationLevel,
                            onSectionProgressUpdate = { passed, score ->
                                chatViewModel.updateSectionProgress(documentId, sectionIndex, passed, score)
                            }
                        )
                        navController.popBackStack()
                        chatViewModel.reExplainSection(p)
                    }
                },
                onBackClick     = {
                        // BUG 3 FIX: go back to learn screen, not chat — preserves learning session
                        navController.popBackStack()
                    },
                score           = score,
                showResults     = showResults,
                quizSoundEnabled = quizSoundEnabled
            )
        }

        composable("setpassword") {
            ChangePasswordScreen(
                onBackClick = {
                    navController.navigate("login") { popUpTo(0) { inclusive = true } }
                },
                onChangePassword = { newPassword, callback ->
                    authViewModel.changePassword(newPassword) { success, msg ->
                        callback(success, msg)
                        if (success) {
                            navController.navigate("login") { popUpTo(0) { inclusive = true } }
                        }
                    }
                }
            )
        }

        composable("changepassword") {
            ChangePasswordScreen(
                onBackClick = { navController.popBackStack() },
                onChangePassword = { newPassword, callback ->
                    authViewModel.changePassword(newPassword, callback)
                }
            )
        }

        composable("privacy") {
            PrivacyPolicyScreen(onBackClick = { navController.popBackStack() })
        }

        composable("terms") {
            TermsOfServiceScreen(onBackClick = { navController.popBackStack() })
        }

        composable("timetable") {
            val profile = (authState as? AuthState.Authenticated)?.profile
            if (profile != null) {
                val entries  by timetableViewModel.entries.collectAsState()
                val loading  by timetableViewModel.isLoading.collectAsState()
                val error    by timetableViewModel.error.collectAsState()
                val insights by timetableViewModel.insights.collectAsState()
                val quizResults by quizViewModel.quizResults.collectAsState()
                LaunchedEffect(profile.userId) {
                    timetableViewModel.load(profile.userId)
                    quizViewModel.loadQuizResults(profile.userId)
                }
                LaunchedEffect(quizResults) {
                    timetableViewModel.loadInsightsWithQuizScores(profile.userId, quizResults)
                }
                TimetableScreen(
                    userProfile    = profile,
                    entries        = entries,
                    isLoading      = loading,
                    errorMessage   = error,
                    insights       = insights,
                    onAddEntry     = { timetableViewModel.addEntry(it, profile) },
                    onDeleteEntry  = { timetableViewModel.deleteEntry(it) },
                    onDismissError = { timetableViewModel.dismissError() },
                    onBackClick    = { navController.popBackStack() }
                )
            }
        }

        composable("progress") {
            val profile = (authState as? AuthState.Authenticated)?.profile
            if (profile != null) {
                val quizResults by quizViewModel.quizResults.collectAsState()
                val quizState   by quizViewModel.quizState.collectAsState()
                LaunchedEffect(profile.userId) {
                    quizViewModel.loadQuizResults(profile.userId)
                }
                LearningProgressScreen(
                    userProfile = profile,
                    quizResults = quizResults,
                    isLoading   = quizState is QuizState.Loading,
                    onBackClick = { navController.popBackStack() }
                )
            }
        }
    }
}
