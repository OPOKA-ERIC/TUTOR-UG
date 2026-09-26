package com.tutorug.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tutorug.app.data.model.Review
import com.tutorug.app.data.repository.FeedbackRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class FeedbackViewModel : ViewModel() {

    private val repo = FeedbackRepository()

    sealed class UiState {
        data object Idle : UiState()
        data object Submitting : UiState()
        data class Submitted(val review: Review?) : UiState()
        data class Error(val message: String) : UiState()
    }

    private val _state = MutableStateFlow<UiState>(UiState.Idle)
    val state = _state.asStateFlow()

    private val _myReviews = MutableStateFlow<List<Review>>(emptyList())
    val myReviews = _myReviews.asStateFlow()

    private val _loadingHistory = MutableStateFlow(false)
    val loadingHistory = _loadingHistory.asStateFlow()

    fun loadMyReviews(userId: String) {
        if (userId.isBlank()) return
        viewModelScope.launch {
            _loadingHistory.value = true
            _myReviews.value = repo.loadMyReviews(userId)
            _loadingHistory.value = false
        }
    }

    /**
     * [rating] is nullable. The form only requires the comment — a student whose
     * login is broken should be able to report that without rating the app.
     */
    fun submit(
        userId: String,
        title: String,
        comment: String,
        rating: Int?,
        appVersion: String,
        screen: String,
        onDone: (Review?) -> Unit
    ) {
        if (_state.value is UiState.Submitting) return
        viewModelScope.launch {
            _state.value = UiState.Submitting
            when (val result = repo.submitReview(userId, title, comment, rating, appVersion, screen)) {
                is FeedbackRepository.SubmitResult.Success -> {
                    _state.value = UiState.Submitted(null)
                    onDone(null)
                    // Refresh the "sent" list so the new entry appears immediately.
                    loadMyReviews(userId)
                }
                is FeedbackRepository.SubmitResult.Failed -> {
                    _state.value = UiState.Error(result.message)
                }
            }
        }
    }

    fun resetState() {
        _state.value = UiState.Idle
    }
}
