package com.tutorug.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tutorug.app.data.model.ChatMessage
import com.tutorug.app.data.model.ChatSession
import com.tutorug.app.data.model.DocumentSection
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

    private val _pendingSubject = MutableStateFlow<Triple<String, String, String>?>(null)

    private val _streamingText = MutableStateFlow("")
    val streamingText: StateFlow<String> = _streamingText

    private val _learningSections = MutableStateFlow<List<DocumentSection>>(emptyList())
    val learningSections: StateFlow<List<DocumentSection>> = _learningSections

    private val _currentSectionIndex = MutableStateFlow(0)
    val currentSectionIndex: StateFlow<Int> = _currentSectionIndex

    private val _learningDocumentId = MutableStateFlow("")
    val learningDocumentId: StateFlow<String> = _learningDocumentId

    // BUG 1 FIX: explicit flag so summary only fires for truly fresh sections,
    // not when resuming (where messages load async and appear empty momentarily)
    private val _allSectionsComplete = MutableStateFlow(false)
    val allSectionsComplete: StateFlow<Boolean> = _allSectionsComplete

    private var shouldTriggerSummary = false

    var autoReadEnabled: Boolean = false

    init {
        voiceManager.initializeTTS()
    }

    fun speak(text: String) = voiceManager.speak(text)
    fun stopSpeaking() = voiceManager.stopSpeaking()

    fun initChat(userProfile: UserProfile) {
        if (_currentSession.value != null && _currentSession.value?.userId != userProfile.userId) {
            clearAllData()
        }
    }

    fun startNewChat(userId: String, subject: String, educationLevel: String) {
        _currentSession.value = null
        _messages.value = emptyList()
        _chatState.value = ChatState.Ready
        _pendingSubject.value = Triple(userId, subject, educationLevel)
    }

    fun startNewChatWithIntro(subject: String, userProfile: UserProfile) {
        startNewChat(userProfile.userId, subject, userProfile.educationLevel)
        val introPrompt = buildString {
            append("The student has just opened the $subject subject. ")
            append("Greet them warmly, briefly introduce what you can help them with in $subject ")
            append("at ${userProfile.educationLevel} level, and ask what specific topic they want to study today. ")
            append("Keep it short, friendly and encouraging. Use their name if available.")
        }
        viewModelScope.launch {
            _chatState.value = ChatState.Loading
            _streamingText.value = ""
            val sessionId = chatRepository.createChatSession(userProfile.userId, subject, userProfile.educationLevel)
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
        // BUG 3 FIX: don't block on Streaming state — only block on Loading
        if (_chatState.value == ChatState.Loading) return
        val session = _currentSession.value
        if (session == null) {
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

    private suspend fun doSend(
        message: String,
        sessionId: String,
        userProfile: UserProfile,
        onSectionComplete: (() -> Unit)? = null
    ) {
        val userMsg = ChatMessage(role = "user", content = message)
        _messages.value = _messages.value + userMsg
        _chatState.value = ChatState.Loading
        _streamingText.value = ""

        val history = _messages.value.dropLast(1)
        val currentSection = if (isLearningMode())
            _learningSections.value.getOrNull(_currentSectionIndex.value)
        else null

        // BUG 4 FIX: track whether the message was persisted to DB before deciding to drop it
        var savedToDb = false

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
            savedToDb = true
            _streamingText.value = ""
            val aiMsg = ChatMessage(role = "assistant", content = fullResponse)
            _messages.value = _messages.value + aiMsg
            _chatState.value = ChatState.Ready
            if (autoReadEnabled) voiceManager.speak(fullResponse)
            viewModelScope.launch { loadChatHistory(userProfile.userId) }
            // BUG 3 FIX: only trigger quiz completion when state is Ready (not mid-stream)
            if (isLearningMode() && onSectionComplete != null && isCompletionMessage(message)) {
                onSectionComplete()
            }
        }.onFailure { e ->
            android.util.Log.e("TutorUG_Chat", "sendMessage error: ${e.message}")
            _streamingText.value = ""
            // BUG 4 FIX: only remove the user message from UI if it was never saved to DB
            if (!savedToDb) {
                _messages.value = _messages.value.dropLast(1)
            }
            _chatState.value = ChatState.Error(e.message ?: "Failed to send message")
        }
    }

    /**
     * Fires a hidden trigger to the AI to summarise the section content from the document.
     * The trigger prompt is NOT added to the visible messages — only the AI summary appears.
     */
    private suspend fun triggerSectionSummary(section: DocumentSection, userProfile: UserProfile) {
        val sessionId = _currentSession.value?.sessionId ?: return
        val triggerPrompt = "Please summarise the key points of this section strictly based on the document content provided. " +
            "Use headings and bullet points. You may use a relatable Ugandan example only to illustrate a concept, " +
            "but every point must come from the document. End by asking what part the student wants to explore further."
        _chatState.value = ChatState.Loading
        _streamingText.value = ""
        chatRepository.sendMessage(
            sessionId = sessionId,
            userMessage = triggerPrompt,
            userProfile = userProfile,
            conversationHistory = _messages.value,
            districtContext = buildDistrictContext(userProfile),
            learningSection = section,
            onToken = { token ->
                _streamingText.value += token
                _chatState.value = ChatState.Streaming
            }
        ).onSuccess { fullResponse ->
            _streamingText.value = ""
            chatRepository.saveMessagePublic(sessionId, userProfile.userId, "assistant", fullResponse)
            _messages.value = _messages.value + ChatMessage(role = "assistant", content = fullResponse)
            _chatState.value = ChatState.Ready
            if (autoReadEnabled) voiceManager.speak(fullResponse)
        }.onFailure {
            _streamingText.value = ""
            _chatState.value = ChatState.Ready
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

    fun editAndResend(originalMessageIndex: Int, newText: String, userProfile: UserProfile) {
        _messages.value = _messages.value.take(originalMessageIndex)
        sendMessage(newText, userProfile)
    }

    fun deleteSession(sessionId: String, userId: String) {
        viewModelScope.launch {
            chatRepository.deleteSession(sessionId, userId)
            _chatHistory.value = _chatHistory.value.filter { it.sessionId != sessionId }
            _learningHistory.value = _learningHistory.value.filter { it.sessionId != sessionId }
            if (_currentSession.value?.sessionId == sessionId) {
                _messages.value = emptyList()
                _currentSession.value = null
            }
        }
    }

    fun startLearning(
        sections: List<DocumentSection>,
        documentId: String,
        userProfile: UserProfile,
        preserveMessages: Boolean = false,
        resumeFromIndex: Int = 0,
        existingSessionId: String? = null,
        // BUG 1 FIX: explicit flag — only true when starting a brand new section, never on resume
        triggerSummary: Boolean = false
    ) {
        _learningSections.value = sections
        // BUG 2 FIX: clamp index to valid range so currentSection is never null on display
        val safeIndex = resumeFromIndex.coerceIn(0, (sections.size - 1).coerceAtLeast(0))
        _currentSectionIndex.value = safeIndex
        _learningDocumentId.value = documentId
        _allSectionsComplete.value = resumeFromIndex >= sections.size
        if (!preserveMessages) _messages.value = emptyList()
        _chatState.value = ChatState.Loading
        shouldTriggerSummary = triggerSummary
        viewModelScope.launch {
            if (existingSessionId != null) {
                _currentSession.value = ChatSession(
                    sessionId = existingSessionId,
                    userId = userProfile.userId,
                    subject = sections.firstOrNull()?.title ?: "Document Learning",
                    educationLevel = userProfile.educationLevel,
                    documentId = documentId,
                    sectionIndex = safeIndex
                )
            } else {
                val subject = sections.firstOrNull()?.title ?: "Document Learning"
                val sessionId = chatRepository.createChatSession(
                    userId = userProfile.userId,
                    subject = subject,
                    educationLevel = userProfile.educationLevel,
                    documentId = documentId
                )
                _currentSession.value = ChatSession(
                    sessionId = sessionId,
                    userId = userProfile.userId,
                    subject = subject,
                    educationLevel = userProfile.educationLevel,
                    documentId = documentId,
                    sectionIndex = 0
                )
            }
            _chatState.value = ChatState.Ready
            // BUG 1 FIX: only trigger summary when explicitly requested (fresh section, not resume)
            if (shouldTriggerSummary) {
                shouldTriggerSummary = false
                val section = sections.getOrNull(safeIndex)
                if (section != null) triggerSectionSummary(section, userProfile)
            }
        }
    }

    fun nextSection(userProfile: UserProfile) {
        val next = _currentSectionIndex.value + 1
        if (next < _learningSections.value.size) {
            _currentSectionIndex.value = next
            _messages.value = emptyList()
            _chatState.value = ChatState.Ready
            val sessionId = _currentSession.value?.sessionId ?: return
            viewModelScope.launch {
                chatRepository.updateSessionSectionIndex(sessionId, next)
                val section = _learningSections.value[next]
                val transitionMsg = "\u2705 Section ${next} complete. Now studying: ${section.title}"
                chatRepository.saveMessagePublic(sessionId, userProfile.userId, "assistant", transitionMsg)
                _messages.value = listOf(ChatMessage(role = "assistant", content = transitionMsg))
                // Always trigger summary for a new section (explicit, not guarded by message count)
                triggerSectionSummary(section, userProfile)
            }
        }
    }

    fun resumeLearning(
        session: ChatSession,
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
            val messages = chatRepository.getSessionMessages(session.sessionId)
            _messages.value = messages
            val resumeIndex = session.sectionIndex.coerceIn(0, sections.size - 1)
            // BUG 1 FIX: triggerSummary = false on resume — messages already exist
            startLearning(
                sections = sections,
                documentId = documentId,
                userProfile = userProfile,
                preserveMessages = true,
                resumeFromIndex = resumeIndex,
                existingSessionId = session.sessionId,
                triggerSummary = false
            )
            onNavigateToLearn()
        }
    }

    fun updateSectionProgress(documentId: String, sectionIndex: Int, passed: Boolean, score: Int) {
        viewModelScope.launch {
            chatRepository.updateSectionProgress(documentId, sectionIndex, passed, score)
            val session = _currentSession.value ?: return@launch
            val emoji = if (passed) "\u2705" else "\u274c"
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
        userMessage: String = "",
        userProfile: UserProfile,
        onNavigateToLearn: () -> Unit
    ) {
        viewModelScope.launch {
            val displayText = if (userMessage.isNotBlank()) "\uD83D\uDCCE $fileName\n$userMessage" else "\uD83D\uDCCE $fileName"
            _messages.value = _messages.value + ChatMessage(role = "user", content = displayText)
            _chatState.value = ChatState.Loading

            val context = getApplication<android.app.Application>()
            val docRepo = com.tutorug.app.data.repository.DocumentRepository(context)
            val subject = when {
                userProfile.educationLevel == "University" -> userProfile.course.ifBlank { "Document Learning" }
                userProfile.educationLevel == "Professional" -> userProfile.profession.ifBlank { "Document Learning" }
                else -> "Document Learning"
            }

            val result = docRepo.uploadDocument(userProfile.userId, fileUri, fileName, subject, userProfile.educationLevel)
            if (result.isFailure) {
                _messages.value = _messages.value + ChatMessage(role = "assistant",
                    content = "Sorry, I couldn't read that document. Please try a PDF, image, or text file.")
                _chatState.value = ChatState.Ready
                return@launch
            }
            val documentId = result.getOrNull()!!

            val sessionId = chatRepository.createChatSession(
                userId = userProfile.userId,
                subject = subject,
                educationLevel = userProfile.educationLevel,
                documentId = documentId
            )
            val newSession = ChatSession(
                sessionId = sessionId,
                userId = userProfile.userId,
                subject = subject,
                educationLevel = userProfile.educationLevel,
                documentId = documentId
            )
            _currentSession.value = newSession
            if (_learningHistory.value.none { it.sessionId == sessionId }) {
                _learningHistory.value = listOf(newSession) + _learningHistory.value
            }

            val processingText = "Reading your document... I'll break it into learning sections for you."
            _messages.value = _messages.value + ChatMessage(role = "assistant", content = processingText)
            chatRepository.saveMessagePublic(sessionId, userProfile.userId, "user", displayText)
            chatRepository.saveMessagePublic(sessionId, userProfile.userId, "assistant", processingText)

            var sections: List<DocumentSection> = emptyList()
            for (attempt in 0 until 30) {
                kotlinx.coroutines.delay(3000)
                val doc = docRepo.getDocument(documentId)
                when (doc?.status) {
                    "ready" -> { sections = docRepo.getDocumentSections(documentId); break }
                    "failed" -> break
                }
            }

            if (sections.isEmpty()) {
                _messages.value = _messages.value + ChatMessage(role = "assistant",
                    content = "I wasn't able to process that document. Please try again with a clearer file.")
                _chatState.value = ChatState.Ready
                return@launch
            }

            val summary = buildString {
                appendLine("Done! I've broken your document into ${sections.size} learning sections:")
                sections.forEachIndexed { i, s -> appendLine("${i + 1}. ${s.title}") }
                appendLine("\nLet's start with Section 1. I'll summarise each section and quiz you at the end.")
            }
            _messages.value = _messages.value + ChatMessage(role = "assistant", content = summary)
            chatRepository.saveMessagePublic(sessionId, userProfile.userId, "assistant", summary)
            _chatState.value = ChatState.Ready

            // BUG 1 FIX: triggerSummary = true — this is a fresh upload, section 1 needs summary
            startLearning(
                sections = sections,
                documentId = documentId,
                userProfile = userProfile,
                preserveMessages = true,
                resumeFromIndex = 0,
                existingSessionId = sessionId,
                triggerSummary = true
            )
            onNavigateToLearn()
        }
    }

    fun isLearningMode() = _learningSections.value.isNotEmpty()

    fun markAllSectionsComplete(userProfile: UserProfile) {
        val total = _learningSections.value.size
        // BUG 2 FIX: use dedicated flag instead of setting index out of bounds
        _allSectionsComplete.value = true
        val sessionId = _currentSession.value?.sessionId ?: return
        viewModelScope.launch {
            chatRepository.updateSessionSectionIndex(sessionId, total)
            val msg = "\uD83C\uDF89 You have completed all $total sections! Great work!"
            chatRepository.saveMessagePublic(sessionId, userProfile.userId, "assistant", msg)
            _messages.value = _messages.value + ChatMessage(role = "assistant", content = msg)
        }
    }

    fun saveSectionIndexOnExit(sessionId: String, sectionIndex: Int) {
        viewModelScope.launch {
            chatRepository.updateSessionSectionIndex(sessionId, sectionIndex)
        }
    }

    fun clearLearningMode() {
        _learningSections.value = emptyList()
        _currentSectionIndex.value = 0
        _learningDocumentId.value = ""
        _allSectionsComplete.value = false
        shouldTriggerSummary = false
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
        _allSectionsComplete.value = false
        shouldTriggerSummary = false
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

    fun selectOrResumeLearning(
        sessionId: String,
        userId: String,
        userProfile: UserProfile,
        onNavigateToLearn: () -> Unit
    ) {
        viewModelScope.launch {
            _chatState.value = ChatState.Loading
            val session = chatRepository.getSession(sessionId, userId)
            if (session == null) {
                _chatState.value = ChatState.Error("Could not load session")
                return@launch
            }
            if (session.documentId != null) {
                resumeLearning(session, userProfile, onNavigateToLearn)
            } else {
                _currentSession.value = session
                _messages.value = session.messages
                _chatState.value = ChatState.Ready
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
