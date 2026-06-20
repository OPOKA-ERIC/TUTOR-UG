package com.tutorug.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tutorug.app.data.model.ChatMessage
import com.tutorug.app.data.model.ChatSession
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.data.repository.ChatRepository
import com.tutorug.app.util.VoiceManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class ChatViewModel(application: Application) : AndroidViewModel(application) {

    private val chatRepository = ChatRepository()
    val voiceManager = VoiceManager(application)

    private val _chatState = MutableStateFlow<ChatState>(ChatState.Idle)
    val chatState: StateFlow<ChatState> = _chatState

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages

    private val _currentSession = MutableStateFlow<ChatSession?>(null)
    val currentSession: StateFlow<ChatSession?> = _currentSession

    private val _chatHistory = MutableStateFlow<List<ChatSession>>(emptyList())
    val chatHistory: StateFlow<List<ChatSession>> = _chatHistory

    private val _learningHistory = MutableStateFlow<List<ChatSession>>(emptyList())
    val learningHistory: StateFlow<List<ChatSession>> = _learningHistory

    // Stores pending subject/userId/level until first message is sent
    private val _pendingSubject = MutableStateFlow<Triple<String, String, String>?>(null)

    // Streaming text — updates token by token while AI is responding
    private val _streamingText = MutableStateFlow("")
    val streamingText: StateFlow<String> = _streamingText

    // Learning mode — document sections
    private val _learningSections = MutableStateFlow<List<com.tutorug.app.data.model.DocumentSection>>(emptyList())
    val learningSections: StateFlow<List<com.tutorug.app.data.model.DocumentSection>> = _learningSections

    private val _currentSectionIndex = MutableStateFlow(0)
    val currentSectionIndex: StateFlow<Int> = _currentSectionIndex

    private val _learningDocumentId = MutableStateFlow("")
    val learningDocumentId: StateFlow<String> = _learningDocumentId

    // autoRead is read directly from SettingsViewModel — injected via setter
    var autoReadEnabled: Boolean = false

    init {
        voiceManager.initializeTTS()
    }

    fun speak(text: String) = voiceManager.speak(text)
    fun stopSpeaking() = voiceManager.stopSpeaking()
    fun pauseSpeaking() = voiceManager.pauseSpeaking()
    fun speedUp() = voiceManager.speedUp()
    fun slowDown() = voiceManager.slowDown()
    fun currentSpeechRate() = voiceManager.getCurrentRate()
    fun isSpeaking() = voiceManager.isSpeaking

    // Which message_id is currently being spoken (empty = none)
    private val _speakingMessageId = MutableStateFlow("")
    val speakingMessageId: StateFlow<String> = _speakingMessageId

    fun speakMessage(messageId: String, text: String) {
        if (_speakingMessageId.value == messageId) {
            // Already speaking this message — stop it
            voiceManager.stopSpeaking()
            _speakingMessageId.value = ""
        } else {
            voiceManager.speak(text)
            _speakingMessageId.value = messageId
        }
    }

    fun stopAndClearSpeaking() {
        voiceManager.stopSpeaking()
        _speakingMessageId.value = ""
    }

    // Called when user enters chat screen — auto-creates a session if none exists
    fun initChat(userProfile: UserProfile) {
        // If there's an existing session belonging to a different user, clear it first
        if (_currentSession.value != null && _currentSession.value?.userId != userProfile.userId) {
            clearAllData()
        }
        // Do NOT create a session here — session is created lazily on first message
    }

    fun startNewChat(userId: String, subject: String, educationLevel: String) {
        // Just reset local state — DB session created lazily on first message
        _currentSession.value = null
        _messages.value = emptyList()
        _chatState.value = ChatState.Ready
        // Store pending subject so sendMessage can use it
        _pendingSubject.value = Triple(userId, subject, educationLevel)
    }

    fun startNewChatWithIntro(subject: String, userProfile: UserProfile) {
        startNewChat(userProfile.userId, subject, userProfile.educationLevel)
        // Fire a hidden system prompt — only the AI reply appears in the chat
        val introPrompt = buildString {
            append("The student has just opened the $subject subject. ")
            append("Greet them warmly, briefly introduce what you can help them with in $subject ")
            append("at ${userProfile.educationLevel} level, and ask what specific topic they want to study today. ")
            append("Keep it short, friendly and encouraging. Use their name if available.")
        }
        viewModelScope.launch {
            _chatState.value = ChatState.Loading
            _streamingText.value = ""
            // Create the session first so we have a sessionId
            val sessionId = chatRepository.createChatSession(
                userProfile.userId, subject, userProfile.educationLevel
            )
            _currentSession.value = ChatSession(
                sessionId = sessionId,
                userId = userProfile.userId,
                subject = subject,
                educationLevel = userProfile.educationLevel
            )
            _pendingSubject.value = null
            if (_chatHistory.value.none { it.sessionId == sessionId }) {
                _chatHistory.value = listOf(_currentSession.value!!) + _chatHistory.value
            }
            chatRepository.sendMessage(
                sessionId = sessionId,
                userMessage = introPrompt,
                userProfile = userProfile,
                conversationHistory = emptyList(),
                districtContext = buildDistrictContext(userProfile),
                onToken = { token ->
                    _streamingText.value += token
                    _chatState.value = ChatState.Streaming
                }
            ).onSuccess { fullResponse ->
                _streamingText.value = ""
                // Only add the AI reply — the intro prompt stays hidden
                _messages.value = listOf(ChatMessage(role = "assistant", content = fullResponse))
                _chatState.value = ChatState.Ready
                if (autoReadEnabled) voiceManager.speak(fullResponse)
            }.onFailure {
                _streamingText.value = ""
                _chatState.value = ChatState.Ready
            }
        }
    }

    fun sendMessage(message: String, userProfile: UserProfile, onSectionComplete: (() -> Unit)? = null) {
        // Block sends while session is being created (Loading state during startLearning)
        if (_chatState.value == ChatState.Loading) return
        val session = _currentSession.value
        if (session == null) {
            // Create session now on first message only
            viewModelScope.launch {
                _chatState.value = ChatState.Loading
                val pending = _pendingSubject.value
                val subject = pending?.second ?: when {
                    userProfile.educationLevel == "University" -> userProfile.course.ifBlank { "General" }
                    userProfile.educationLevel == "Professional" -> userProfile.profession.ifBlank { "General" }
                    else -> "General"
                }
                val sessionId = chatRepository.createChatSession(userProfile.userId, subject, userProfile.educationLevel)
                _currentSession.value = ChatSession(
                    sessionId = sessionId,
                    userId = userProfile.userId,
                    subject = subject,
                    educationLevel = userProfile.educationLevel
                )
                _pendingSubject.value = null
                // Add new session to history immediately
                val newSession = _currentSession.value!!
                if (_chatHistory.value.none { it.sessionId == newSession.sessionId }) {
                    _chatHistory.value = listOf(newSession) + _chatHistory.value
                }
                doSend(message, sessionId, userProfile, onSectionComplete)
            }
            return
        }
        viewModelScope.launch { doSend(message, session.sessionId, userProfile, onSectionComplete) }
    }

    private suspend fun doSend(message: String, sessionId: String, userProfile: UserProfile, onSectionComplete: (() -> Unit)? = null) {
        val userMsg = ChatMessage(role = "user", content = message)
        _messages.value = _messages.value + userMsg
        _chatState.value = ChatState.Loading
        _streamingText.value = ""

        val history = _messages.value.dropLast(1)

        // In learning mode, prepend the section content as context
        val currentSection = if (isLearningMode())
            _learningSections.value.getOrNull(_currentSectionIndex.value)
        else null

        chatRepository.sendMessage(
            sessionId = sessionId,
            userMessage = message,
            userProfile = userProfile,
            conversationHistory = history,
            districtContext = buildDistrictContext(userProfile),
            learningSection = currentSection,
            onToken = { token ->
                _streamingText.value += token
                _chatState.value = ChatState.Streaming
            }
        ).onSuccess { fullResponse ->
            _streamingText.value = ""
            val aiMsg = ChatMessage(role = "assistant", content = fullResponse)
            _messages.value = _messages.value + aiMsg
            _chatState.value = ChatState.Ready
            if (autoReadEnabled) voiceManager.speak(fullResponse)
            // Refresh chat history so sidebar and history screen update
            viewModelScope.launch { loadChatHistory(userProfile.userId) }
            // Auto-detect completion intent and trigger quiz
            if (isLearningMode() && onSectionComplete != null && isCompletionMessage(message)) {
                onSectionComplete()
            }
        }.onFailure { e ->
            android.util.Log.e("TutorUG_Chat", "sendMessage error: ${e.message}")
            _streamingText.value = ""
            _messages.value = _messages.value.dropLast(1)
            _chatState.value = ChatState.Error(e.message ?: "Failed to send message")
        }
    }

    private fun isCompletionMessage(message: String): Boolean {
        val lower = message.lowercase().trim()
        val keywords = listOf(
            "done", "understood", "i understand", "i get it", "got it", "i'm done",
            "completed", "finish", "finished", "ready for quiz", "take quiz",
            "ready", "let's move on", "move on", "next section", "i'm ready"
        )
        return keywords.any { lower.contains(it) }
    }

    private fun buildDistrictContext(profile: UserProfile): String {
        return buildString {
            append("Student: ${profile.name}")
            append(", District: ${profile.district}")
            append(", Level: ${profile.educationLevel}")
            when {
                profile.educationLevel == "University" && profile.course.isNotBlank() ->
                    append(", Course: ${profile.course}")
                profile.educationLevel == "Professional" && profile.profession.isNotBlank() ->
                    append(", Profession: ${profile.profession}")
                profile.educationLevel in listOf("S5", "S6") && profile.combination.isNotBlank() ->
                    append(", Combination: ${profile.combination}")
            }
        }
    }

    fun deleteSession(sessionId: String, userId: String) {
        viewModelScope.launch {
            chatRepository.deleteSession(sessionId, userId)
            // Remove from both local lists immediately
            _chatHistory.value = _chatHistory.value.filter { it.sessionId != sessionId }
            _learningHistory.value = _learningHistory.value.filter { it.sessionId != sessionId }
            // If the deleted session is currently open, clear messages
            if (_currentSession.value?.sessionId == sessionId) {
                _messages.value = emptyList()
                _currentSession.value = null
            }
        }
    }

    fun startLearning(
        sections: List<com.tutorug.app.data.model.DocumentSection>,
        documentId: String,
        userProfile: UserProfile,
        preserveMessages: Boolean = false,
        resumeFromIndex: Int = 0,
        existingSessionId: String? = null
    ) {
        _learningSections.value = sections
        _currentSectionIndex.value = resumeFromIndex
        _learningDocumentId.value = documentId
        if (!preserveMessages) _messages.value = emptyList()
        _chatState.value = ChatState.Loading
        viewModelScope.launch {
            if (existingSessionId != null) {
                // Resume existing session — just restore it
                _currentSession.value = com.tutorug.app.data.model.ChatSession(
                    sessionId = existingSessionId,
                    userId = userProfile.userId,
                    subject = sections.firstOrNull()?.title ?: "Document Learning",
                    educationLevel = userProfile.educationLevel,
                    documentId = documentId,
                    sectionIndex = resumeFromIndex
                )
            } else {
                // New session — one session covers the entire document
                val subject = sections.firstOrNull()?.title ?: "Document Learning"
                val sessionId = chatRepository.createChatSession(
                    userId = userProfile.userId,
                    subject = subject,
                    educationLevel = userProfile.educationLevel,
                    documentId = documentId
                )
                _currentSession.value = com.tutorug.app.data.model.ChatSession(
                    sessionId = sessionId,
                    userId = userProfile.userId,
                    subject = subject,
                    educationLevel = userProfile.educationLevel,
                    documentId = documentId,
                    sectionIndex = 0
                )
            }
            _chatState.value = ChatState.Ready
        }
    }

    fun nextSection(userProfile: UserProfile) {
        val next = _currentSectionIndex.value + 1
        if (next < _learningSections.value.size) {
            _currentSectionIndex.value = next
            _messages.value = emptyList()
            _chatState.value = ChatState.Ready
            // Update the session's section_index in DB — same session, just advance the pointer
            val sessionId = _currentSession.value?.sessionId ?: return
            viewModelScope.launch {
                chatRepository.updateSessionSectionIndex(sessionId, next)
                // Post a section transition message so history shows the progression
                val section = _learningSections.value[next]
                val transitionMsg = "✅ Section ${next} complete. Now studying: ${section.title}"
                chatRepository.saveMessagePublic(sessionId, userProfile.userId, "assistant", transitionMsg)
                _messages.value = listOf(ChatMessage(role = "assistant", content = transitionMsg))
            }
        }
    }

    /** Resume a document learning session from chat history. */
    fun resumeLearning(
        session: com.tutorug.app.data.model.ChatSession,
        userProfile: UserProfile,
        onNavigateToLearn: () -> Unit
    ) {
        val documentId = session.documentId ?: return
        viewModelScope.launch {
            _chatState.value = ChatState.Loading
            val context = getApplication<android.app.Application>()
            val docRepo = com.tutorug.app.data.repository.DocumentRepository(context)
            val sections = docRepo.getDocumentSections(documentId)
            if (sections.isEmpty()) {
                _chatState.value = ChatState.Error("Could not load document sections")
                return@launch
            }
            // Load all messages from this session
            val messages = chatRepository.getSessionMessages(session.sessionId)
            _messages.value = messages
            // Resume from the saved section index
            val resumeIndex = session.sectionIndex.coerceIn(0, sections.size - 1)
            startLearning(
                sections = sections,
                documentId = documentId,
                userProfile = userProfile,
                preserveMessages = true,
                resumeFromIndex = resumeIndex,
                existingSessionId = session.sessionId
            )
            onNavigateToLearn()
        }
    }

    fun updateSectionProgress(documentId: String, sectionIndex: Int, passed: Boolean, score: Int) {
        viewModelScope.launch {
            chatRepository.updateSectionProgress(documentId, sectionIndex, passed, score)
            // Also save a quiz result summary message into the session so history shows scores
            val session = _currentSession.value ?: return@launch
            val emoji = if (passed) "✅" else "❌"
            val msg = "$emoji Quiz result for Section ${sectionIndex + 1}: $score% (${if (passed) "Passed" else "Failed"})"
            chatRepository.saveMessagePublic(session.sessionId, session.userId, "assistant", msg)
            _messages.value = _messages.value + ChatMessage(role = "assistant", content = msg)
        }
    }

    fun reExplainSection(userProfile: UserProfile) {
        val section = _learningSections.value.getOrNull(_currentSectionIndex.value) ?: return
        sendMessage(
            "Please re-explain this section in a completely different way with new examples from ${userProfile.district}.",
            userProfile
        )
    }

    fun uploadAndStartLearning(
        fileUri: android.net.Uri,
        fileName: String,
        userProfile: UserProfile,
        onNavigateToLearn: () -> Unit
    ) {
        viewModelScope.launch {
            // Post a user-side message so the chat shows what was uploaded
            val userMsg = ChatMessage(role = "user", content = "📎 $fileName")
            _messages.value = _messages.value + userMsg
            _chatState.value = ChatState.Loading

            // Ensure we have a session
            if (_currentSession.value == null) {
                val subject = when {
                    userProfile.educationLevel == "University" -> userProfile.course.ifBlank { "Document Learning" }
                    userProfile.educationLevel == "Professional" -> userProfile.profession.ifBlank { "Document Learning" }
                    else -> "Document Learning"
                }
                val sessionId = chatRepository.createChatSession(userProfile.userId, subject, userProfile.educationLevel)
                _currentSession.value = ChatSession(
                    sessionId = sessionId,
                    userId = userProfile.userId,
                    subject = subject,
                    educationLevel = userProfile.educationLevel
                )
                if (_chatHistory.value.none { it.sessionId == sessionId }) {
                    _chatHistory.value = listOf(_currentSession.value!!) + _chatHistory.value
                }
            }

            // Post a processing AI message
            val processingMsg = ChatMessage(role = "assistant", content = "Reading your document... I'll break it into learning sections for you.")
            _messages.value = _messages.value + processingMsg

            // Save both messages to DB
            _currentSession.value?.let { session ->
                chatRepository.saveMessagePublic(session.sessionId, userProfile.userId, "user", "📎 $fileName")
                chatRepository.saveMessagePublic(session.sessionId, userProfile.userId, "assistant", processingMsg.content)
            }

            // Upload and process the document
            val context = getApplication<android.app.Application>()
            val docRepo = com.tutorug.app.data.repository.DocumentRepository(context)
            val subject = when {
                userProfile.educationLevel == "University" -> userProfile.course.ifBlank { "General" }
                userProfile.educationLevel == "Professional" -> userProfile.profession.ifBlank { "General" }
                else -> "General"
            }
            val result = docRepo.uploadDocument(userProfile.userId, fileUri, fileName, subject, userProfile.educationLevel)
            if (result.isFailure) {
                val errMsg = ChatMessage(role = "assistant", content = "Sorry, I couldn't read that document. Please try a PDF, image, or text file.")
                _messages.value = _messages.value + errMsg
                _chatState.value = ChatState.Ready
                return@launch
            }

            val documentId = result.getOrNull()!!
            // Poll for processing — use a proper loop with early exit
            var sections: List<com.tutorug.app.data.model.DocumentSection> = emptyList()
            var processed = false
            for (attempt in 0 until 30) {
                kotlinx.coroutines.delay(3000)
                val doc = docRepo.getDocument(documentId)
                when (doc?.status) {
                    "ready" -> {
                        sections = docRepo.getDocumentSections(documentId)
                        processed = true
                        break
                    }
                    "failed" -> {
                        processed = true
                        break
                    }
                }
            }

            if (sections.isEmpty()) {
                val errMsg = ChatMessage(role = "assistant", content = "I wasn't able to process that document. Please try again with a clearer file.")
                _messages.value = _messages.value + errMsg
                _chatState.value = ChatState.Ready
                return@launch
            }

            // Post sections summary into chat
            val summary = buildString {
                appendLine("Done! I've broken your document into ${sections.size} learning sections:")
                sections.forEachIndexed { i, s -> appendLine("${i + 1}. ${s.title}") }
                appendLine("\nLet's start with Section 1. I'll guide you through each one and quiz you at the end of each section.")
            }
            val summaryMsg = ChatMessage(role = "assistant", content = summary)
            _messages.value = _messages.value + summaryMsg
            _currentSession.value?.let { session ->
                chatRepository.saveMessagePublic(session.sessionId, userProfile.userId, "assistant", summary)
            }

            _chatState.value = ChatState.Ready

            // Start learning mode — preserve the upload/summary messages already in chat
            startLearning(sections, documentId, userProfile, preserveMessages = true)
            onNavigateToLearn()
        }
    }

    fun isLearningMode() = _learningSections.value.isNotEmpty()

    fun clearLearningMode() {
        _learningSections.value = emptyList()
        _currentSectionIndex.value = 0
        _learningDocumentId.value = ""
    }

    fun clearAllData() {
        _messages.value = emptyList()
        _currentSession.value = null
        _chatHistory.value = emptyList()
        _learningHistory.value = emptyList()
        _chatState.value = ChatState.Idle
        _pendingSubject.value = null
        _streamingText.value = ""
        _learningSections.value = emptyList()
        _currentSectionIndex.value = 0
        _learningDocumentId.value = ""
    }

    fun loadChatHistory(userId: String) {
        viewModelScope.launch {
            try {
                _chatHistory.value = chatRepository.getChatHistory(userId)
                _learningHistory.value = chatRepository.getLearningHistory(userId)
            } catch (e: Exception) {
                android.util.Log.e("TutorUG_Chat", "loadChatHistory error: ${e.message}")
            }
        }
    }

    fun selectSession(sessionId: String, userId: String) {
        viewModelScope.launch {
            _chatState.value = ChatState.Loading
            try {
                val session = chatRepository.getSession(sessionId, userId)
                _currentSession.value = session
                _messages.value = session?.messages ?: emptyList()
                _chatState.value = ChatState.Ready
            } catch (e: Exception) {
                _chatState.value = ChatState.Error("Could not load session")
            }
        }
    }

    fun dismissError() {
        _chatState.value = ChatState.Ready
    }

    override fun onCleared() {
        super.onCleared()
        voiceManager.shutdown()
    }
}

sealed class ChatState {
    object Idle      : ChatState()
    object Ready     : ChatState()
    object Loading   : ChatState()
    object Streaming : ChatState()
    data class Error(val message: String) : ChatState()
}
