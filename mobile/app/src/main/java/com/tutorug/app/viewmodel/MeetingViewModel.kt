package com.tutorug.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tutorug.app.data.model.Meeting
import com.tutorug.app.data.repository.MeetingRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

sealed class MeetingState {
    object Idle : MeetingState()
    object Loading : MeetingState()
    data class Error(val message: String) : MeetingState()
}

class MeetingViewModel : ViewModel() {
    private val repo = MeetingRepository()

    private val _meetings = MutableStateFlow<List<Meeting>>(emptyList())
    val meetings = _meetings.asStateFlow()

    private val _state = MutableStateFlow<MeetingState>(MeetingState.Idle)
    val state = _state.asStateFlow()

    // null = list view; non-null = in-meeting
    private val _activeMeeting = MutableStateFlow<Pair<String, String>?>(null) // roomUrl, token
    val activeMeeting = _activeMeeting.asStateFlow()

    fun load() {
        viewModelScope.launch {
            _state.value = MeetingState.Loading
            try { _meetings.value = repo.loadMeetings() }
            catch (e: Exception) { _state.value = MeetingState.Error(e.message ?: "Failed to load") }
            finally { _state.value = MeetingState.Idle }
        }
    }

    fun create(
        hostId: String, title: String, subject: String,
        description: String, scheduledAt: String, durationMins: Int,
        onDone: () -> Unit
    ) {
        viewModelScope.launch {
            _state.value = MeetingState.Loading
            try {
                val id = UUID.randomUUID().toString()
                repo.createMeeting(id, hostId, title, subject, description, scheduledAt, durationMins)
                load()
                onDone()
            } catch (e: Exception) {
                _state.value = MeetingState.Error(e.message ?: "Failed to create")
            }
        }
    }

    fun join(meeting: Meeting, userId: String) {
        viewModelScope.launch {
            _state.value = MeetingState.Loading
            try {
                val isHost = meeting.hostId == userId
                val token = if (isHost) meeting.roomToken
                else repo.getParticipantToken(meeting.meetingId, userId, meeting)
                if (isHost) repo.updateStatus(meeting.meetingId, "live")
                _activeMeeting.value = meeting.roomUrl to token
            } catch (e: Exception) {
                _state.value = MeetingState.Error(e.message ?: "Failed to join")
            } finally {
                _state.value = MeetingState.Idle
            }
        }
    }

    fun leaveMeeting() { _activeMeeting.value = null; load() }

    fun dismissError() { _state.value = MeetingState.Idle }
}
