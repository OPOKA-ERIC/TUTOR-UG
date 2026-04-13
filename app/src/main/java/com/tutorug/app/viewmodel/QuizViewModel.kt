package com.tutorug.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tutorug.app.data.model.QuizQuestion
import com.tutorug.app.data.model.QuizResult
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.data.repository.QuizRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class QuizViewModel(application: Application) : AndroidViewModel(application) {

    private val quizRepository = QuizRepository()

    private val _quizState  = MutableStateFlow<QuizState>(QuizState.Idle)
    val quizState: StateFlow<QuizState> = _quizState

    private val _questions  = MutableStateFlow<List<QuizQuestion>>(emptyList())
    val questions: StateFlow<List<QuizQuestion>> = _questions

    private val _answers    = MutableStateFlow<Map<Int, Int>>(emptyMap())
    val answers: StateFlow<Map<Int, Int>> = _answers

    private val _quizResults = MutableStateFlow<List<QuizResult>>(emptyList())
    val quizResults: StateFlow<List<QuizResult>> = _quizResults

    fun loadQuizResults(userId: String) {
        viewModelScope.launch {
            _quizResults.value = quizRepository.getUserQuizResults(userId)
        }
    }

    fun generateQuiz(sectionContent: String, userProfile: UserProfile, districtContext: String) {
        viewModelScope.launch {
            _quizState.value = QuizState.Loading
            quizRepository.generateQuiz(sectionContent, userProfile, districtContext)
                .onSuccess { questions ->
                    _questions.value = questions
                    _answers.value = emptyMap()
                    _quizState.value = QuizState.Ready
                }.onFailure { e ->
                    _quizState.value = QuizState.Error(e.message ?: "Failed to generate quiz")
                }
        }
    }

    fun submitAnswer(questionIndex: Int, answerIndex: Int) {
        _answers.value = _answers.value.toMutableMap().also { it[questionIndex] = answerIndex }
    }

    fun calculateScore(): Int {
        val total = _questions.value.size
        if (total == 0) return 0
        val correct = _answers.value.count { (index, answer) ->
            _questions.value.getOrNull(index)?.correctIndex == answer
        }
        return (correct * 100) / total
    }

    fun saveResult(
        userId: String,
        documentId: String,
        sectionTitle: String,
        sectionIndex: Int = 0,
        difficulty: String = "adaptive",
        subject: String = "",
        educationLevel: String = "",
        onSectionProgressUpdate: ((passed: Boolean, score: Int) -> Unit)? = null
    ) {
        val score   = calculateScore()
        val total   = _questions.value.size
        val correct = _answers.value.count { (index, answer) ->
            _questions.value.getOrNull(index)?.correctIndex == answer
        }
        val passed = score >= 70
        val result = QuizResult(
            userId          = userId,
            documentId      = documentId.ifBlank { null },
            sectionTitle    = sectionTitle,
            subject         = subject,
            educationLevel  = educationLevel,
            score           = score,
            totalQuestions  = total,
            correctAnswers  = correct,
            passed          = passed,
            difficulty      = difficulty
        )
        viewModelScope.launch {
            quizRepository.saveQuizResult(result)
            _quizResults.value = quizRepository.getUserQuizResults(userId)
            _quizState.value = QuizState.Idle
            onSectionProgressUpdate?.invoke(passed, score)
        }
    }

    fun resetQuiz() {
        _answers.value   = emptyMap()
        _questions.value = emptyList()
        _quizState.value = QuizState.Idle
    }

    /** Atomically resets stale state then generates new questions — prevents old questions flashing. */
    fun resetAndGenerate(sectionContent: String, userProfile: UserProfile, districtContext: String) {
        _answers.value   = emptyMap()
        _questions.value = emptyList()
        _quizState.value = QuizState.Loading
        viewModelScope.launch {
            quizRepository.generateQuiz(sectionContent, userProfile, districtContext)
                .onSuccess { questions ->
                    _questions.value = questions
                    _quizState.value = QuizState.Ready
                }.onFailure { e ->
                    _quizState.value = QuizState.Error(e.message ?: "Failed to generate quiz")
                }
        }
    }
}

sealed class QuizState {
    object Idle    : QuizState()
    object Loading : QuizState()
    object Ready   : QuizState()
    data class Error(val message: String) : QuizState()
}
