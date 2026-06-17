package com.tutorug.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tutorug.app.data.model.PodcastSegment
import com.tutorug.app.data.model.PodcastSession
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.data.repository.PodcastRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

class PodcastViewModel : ViewModel() {
    private val repo = PodcastRepository()

    private val _script = MutableStateFlow<List<PodcastSegment>>(emptyList())
    val script = _script.asStateFlow()

    private val _history = MutableStateFlow<List<PodcastSession>>(emptyList())
    val history = _history.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading = _loading.asStateFlow()

    private val _followUpLoading = MutableStateFlow(false)
    val followUpLoading = _followUpLoading.asStateFlow()

    private val _currentTopic = MutableStateFlow("")
    val currentTopic = _currentTopic.asStateFlow()

    // Tracks conversation for follow-up context
    private val conversationHistory = mutableListOf<Map<String, String>>()

    fun loadHistory(userId: String) {
        viewModelScope.launch {
            try { _history.value = repo.loadHistory(userId) }
            catch (_: Exception) {}
        }
    }

    fun generate(topic: String, subject: String, userProfile: UserProfile) {
        viewModelScope.launch {
            _loading.value = true
            try {
                val segments = repo.generatePodcast(topic, userProfile, emptyList())
                _script.value = segments
                _currentTopic.value = topic
                conversationHistory.clear()
                conversationHistory.add(mapOf(
                    "role" to "assistant",
                    "content" to segments.joinToString("\n") { "${it.speaker}: ${it.text}" }
                ))
                // Save session
                val session = PodcastSession(
                    podcastId = UUID.randomUUID().toString(),
                    userId = userProfile.userId,
                    topic = topic,
                    subject = subject,
                    educationLevel = userProfile.educationLevel,
                    script = segments,
                    durationSecs = segments.size * 15,
                    createdAt = Instant.now().toString()
                )
                repo.saveSession(session)
                loadHistory(userProfile.userId)
            } catch (_: Exception) {
            } finally {
                _loading.value = false
            }
        }
    }

    fun followUp(followUpTopic: String, userProfile: UserProfile) {
        viewModelScope.launch {
            _followUpLoading.value = true
            try {
                val newSegments = repo.generatePodcast(followUpTopic, userProfile, conversationHistory.toList())
                val updated = _script.value + newSegments
                _script.value = updated
                conversationHistory.add(mapOf(
                    "role" to "assistant",
                    "content" to newSegments.joinToString("\n") { "${it.speaker}: ${it.text}" }
                ))
            } catch (_: Exception) {
            } finally {
                _followUpLoading.value = false
            }
        }
    }

    fun loadSession(session: PodcastSession) {
        _script.value = session.script
        _currentTopic.value = session.topic
        conversationHistory.clear()
        conversationHistory.add(mapOf(
            "role" to "assistant",
            "content" to session.script.joinToString("\n") { "${it.speaker}: ${it.text}" }
        ))
    }

    fun reset() {
        _script.value = emptyList()
        _currentTopic.value = ""
        conversationHistory.clear()
    }
}
