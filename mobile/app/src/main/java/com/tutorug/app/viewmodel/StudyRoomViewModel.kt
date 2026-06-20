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

    // true for ~3s when a message is blocked
    private val _messageBlocked = MutableStateFlow(false)
    val messageBlocked = _messageBlocked.asStateFlow()

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
        userAvatar: String, content: String, subject: String
    ) {
        viewModelScope.launch {
            _sending.value = true
            val allowed = repo.moderateAndSend(roomId, userId, userName, userAvatar, content, subject)
            if (!allowed) {
                _messageBlocked.value = true
                kotlinx.coroutines.delay(3500)
                _messageBlocked.value = false
            } else {
                // Reload messages to reflect new entry
                _messages.value = repo.loadMessages(roomId)
            }
            _sending.value = false
        }
    }

    fun clearMessages() { _messages.value = emptyList() }
}
