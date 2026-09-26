package com.tutorug.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tutorug.app.data.model.RoomMessage
import com.tutorug.app.data.model.StudyRoom
import com.tutorug.app.data.repository.StudyRoomRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class StudyRoomViewModel : ViewModel() {
    private val repo = StudyRoomRepository()

    private val _rooms = MutableStateFlow<List<StudyRoom>>(emptyList())
    val rooms = _rooms.asStateFlow()

    private val _messages = MutableStateFlow<List<RoomMessage>>(emptyList())
    val messages = _messages.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading = _loading.asStateFlow()

    private val _sending = MutableStateFlow(false)
    val sending = _sending.asStateFlow()

    // Set while a rejected message is being explained to its sender. Private to the
    // sender's own screen: the text is never persisted, so the group never sees it.
    private val _blockedReason = MutableStateFlow<String?>(null)
    val blockedReason = _blockedReason.asStateFlow()

    fun loadRooms() {
        viewModelScope.launch {
            _loading.value = true
            try { _rooms.value = repo.loadRooms() }
            finally { _loading.value = false }
        }
    }

    fun loadMessages(roomId: String) {
        viewModelScope.launch {
            _loading.value = true
            try { _messages.value = repo.loadMessages(roomId) }
            finally { _loading.value = false }
        }
    }

    fun sendMessage(
        roomId: String, userId: String, userName: String,
        userAvatar: String, content: String, subject: String,
        educationLevel: String = ""
    ) {
        viewModelScope.launch {
            _sending.value = true
            val result = repo.moderateAndSend(
                roomId, userId, userName, userAvatar, content, subject, educationLevel
            )
            if (!result.allowed) {
                // Fall back to a generic line if the gatekeeper gave no reason.
                _blockedReason.value = result.reason.ifBlank {
                    "This message was not sent because it is not related to this room's subject."
                }
                kotlinx.coroutines.delay(6000)
                _blockedReason.value = null
            } else {
                // Reload messages to reflect new entry
                _messages.value = repo.loadMessages(roomId)
            }
            _sending.value = false
        }
    }

    /** Called when the student switches rooms, so a stale notice cannot linger. */
    fun clearBlockedReason() { _blockedReason.value = null }

    fun clearMessages() {
        _messages.value = emptyList()
        // A rejection notice belongs to the room it was raised in.
        _blockedReason.value = null
    }
}
