package com.tutorug.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tutorug.app.data.model.Meeting
import com.tutorug.app.data.model.MeetingInvite
import com.tutorug.app.data.model.MeetingParticipant
import com.tutorug.app.data.repository.MeetingRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

sealed class MeetingState {
    object Idle : MeetingState()
    object Loading : MeetingState()
    data class Error(val message: String) : MeetingState()
    data class Success(val message: String) : MeetingState()
}

class MeetingViewModel : ViewModel() {
    private val repo = MeetingRepository()

    private val _meetings = MutableStateFlow<List<Meeting>>(emptyList())
    val meetings = _meetings.asStateFlow()

    private val _invitedMeetings = MutableStateFlow<List<Meeting>>(emptyList())
    val invitedMeetings = _invitedMeetings.asStateFlow()

    private val _state = MutableStateFlow<MeetingState>(MeetingState.Idle)
    val state = _state.asStateFlow()

    private val _activeMeeting = MutableStateFlow<Pair<String, String>?>(null)
    val activeMeeting = _activeMeeting.asStateFlow()

    private val _participants = MutableStateFlow<List<MeetingParticipant>>(emptyList())
    val participants = _participants.asStateFlow()

    private val _invites = MutableStateFlow<List<MeetingInvite>>(emptyList())
    val invites = _invites.asStateFlow()

    fun load(userId: String? = null, email: String = "") {
        viewModelScope.launch {
            _state.value = MeetingState.Loading
            try {
                _meetings.value = repo.loadMeetings()
                if (userId != null) {
                    _invitedMeetings.value = repo.loadInvitedMeetings(userId, email)
                }
            } catch (e: Exception) { _state.value = MeetingState.Error(e.message ?: "Failed to load") }
            finally { _state.value = MeetingState.Idle }
        }
    }

    fun create(
        hostId: String, title: String, subject: String,
        description: String, scheduledAt: String, durationMins: Int,
        hostName: String, onDone: () -> Unit
    ) {
        viewModelScope.launch {
            _state.value = MeetingState.Loading
            try {
                val id = UUID.randomUUID().toString()
                repo.createMeeting(id, hostId, title, subject, description, scheduledAt, durationMins, hostName)
                load(hostId)
                onDone()
            } catch (e: Exception) {
                _state.value = MeetingState.Error(e.message ?: "Failed to create")
            }
        }
    }

    fun deleteMeeting(meetingId: String) {
        viewModelScope.launch {
            try {
                repo.deleteMeeting(meetingId)
                _meetings.value = _meetings.value.filter { it.meetingId != meetingId }
                _invitedMeetings.value = _invitedMeetings.value.filter { it.meetingId != meetingId }
                _state.value = MeetingState.Success("Meeting deleted")
            } catch (e: Exception) {
                _state.value = MeetingState.Error(e.message ?: "Failed to delete")
            }
        }
    }

    fun join(meeting: Meeting, userId: String, userName: String) {
        viewModelScope.launch {
            _state.value = MeetingState.Loading
            try {
                val isHost = meeting.hostId == userId
                if (isHost) {
                    val token = meeting.roomToken.ifBlank { "" }
                    repo.updateStatus(meeting.meetingId, "live")
                    _activeMeeting.value = meeting.roomUrl to token
                } else if (_invitedMeetings.value.any { it.meetingId == meeting.meetingId }) {
                    // Invited people join instantly — no host approval needed.
                    val token = repo.getParticipantToken(meeting.meetingId, userId, meeting, userName)
                    repo.updateStatus(meeting.meetingId, "live")
                    _activeMeeting.value = meeting.roomUrl to token
                } else {
                    repo.requestJoin(meeting.meetingId, userId)
                    _state.value = MeetingState.Success("Join request sent! Waiting for host approval.")
                }
            } catch (e: Exception) {
                _state.value = MeetingState.Error(e.message ?: "Failed to join")
            } finally {
                if (_state.value is MeetingState.Loading) _state.value = MeetingState.Idle
            }
        }
    }

    fun joinApproved(meeting: Meeting, userId: String, userName: String) {
        viewModelScope.launch {
            _state.value = MeetingState.Loading
            try {
                val token = repo.getParticipantToken(meeting.meetingId, userId, meeting, userName)
                repo.updateStatus(meeting.meetingId, "live")
                _activeMeeting.value = meeting.roomUrl to token
            } catch (e: Exception) {
                _state.value = MeetingState.Error(e.message ?: "Failed to join")
            } finally {
                if (_state.value is MeetingState.Loading) _state.value = MeetingState.Idle
            }
        }
    }

    fun loadParticipants(meetingId: String) {
        viewModelScope.launch {
            try {
                _participants.value = repo.loadParticipants(meetingId)
            } catch (e: Exception) { }
        }
    }

    fun approveParticipant(participantId: String) {
        viewModelScope.launch {
            try {
                repo.approveParticipant(participantId)
                _participants.value = _participants.value.map {
                    if (it.id == participantId) it.copy(status = "approved") else it
                }
                _state.value = MeetingState.Success("Participant approved")
            } catch (e: Exception) {
                _state.value = MeetingState.Error(e.message ?: "Failed to approve")
            }
        }
    }

    fun refuseParticipant(participantId: String) {
        viewModelScope.launch {
            try {
                repo.refuseParticipant(participantId)
                _participants.value = _participants.value.map {
                    if (it.id == participantId) it.copy(status = "refused") else it
                }
                _state.value = MeetingState.Success("Participant refused")
            } catch (e: Exception) {
                _state.value = MeetingState.Error(e.message ?: "Failed to refuse")
            }
        }
    }

    fun loadInvites(meetingId: String) {
        viewModelScope.launch {
            try {
                _invites.value = repo.loadInvites(meetingId)
            } catch (e: Exception) { }
        }
    }

    fun sendInvites(meetingId: String, emails: List<String>, hostName: String) {
        viewModelScope.launch {
            _state.value = MeetingState.Loading
            try {
                repo.sendInvites(meetingId, emails, hostName)
                _state.value = MeetingState.Success("Invites sent!")
                loadInvites(meetingId)
            } catch (e: Exception) {
                _state.value = MeetingState.Error(e.message ?: "Failed to send invites")
            }
        }
    }

    fun leaveMeeting() { _activeMeeting.value = null; load() }

    fun dismissError() { _state.value = MeetingState.Idle }
}
