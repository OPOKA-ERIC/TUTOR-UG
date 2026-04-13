package com.tutorug.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tutorug.app.data.local.DistrictDatabase
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.data.repository.AuthRepository
import com.tutorug.app.util.Constants
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class AuthViewModel(application: Application) : AndroidViewModel(application) {
    
    private val authRepository = AuthRepository()
    private val districtDatabase = DistrictDatabase(application)
    
    private val _authState = MutableStateFlow<AuthState>(AuthState.Idle)
    val authState: StateFlow<AuthState> = _authState
    
    private val _districts = MutableStateFlow<List<String>>(emptyList())
    val districts: StateFlow<List<String>> = _districts

    private val _educationLevels = MutableStateFlow<List<String>>(emptyList())
    val educationLevels: StateFlow<List<String>> = _educationLevels

    init {
        _districts.value = districtDatabase.getAllDistrictNames()
        _educationLevels.value = Constants.EDUCATION_LEVELS
        checkLoginStatus()
    }
    
    private fun checkLoginStatus() {
        val userId = authRepository.getCurrentUserId()
        if (userId != null) {
            viewModelScope.launch {
                _authState.value = AuthState.Loading
                authRepository.getUserProfile(userId).onSuccess { profile ->
                    _authState.value = AuthState.Authenticated(profile)
                }.onFailure {
                    authRepository.logout()
                    _authState.value = AuthState.Idle
                }
            }
        }
    }
    
    fun register(email: String, password: String, profile: UserProfile) {
        viewModelScope.launch {
            _authState.value = AuthState.Loading
            authRepository.register(email, password, profile).onSuccess { userId ->
                _authState.value = AuthState.Registered
            }.onFailure { e ->
                _authState.value = AuthState.Error(parseError(e.message))
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _authState.value = AuthState.Loading
            authRepository.login(email, password).onSuccess { profile ->
                // Fetch full fresh profile from DB to ensure name, avatar_url etc are loaded
                authRepository.getUserProfile(profile.userId).onSuccess { freshProfile ->
                    _authState.value = AuthState.Authenticated(freshProfile)
                }.onFailure {
                    _authState.value = AuthState.Authenticated(profile)
                }
            }.onFailure { e ->
                _authState.value = AuthState.Error(parseError(e.message))
            }
        }
    }

    private fun parseError(raw: String?): String {
        if (raw == null) return "Something went wrong. Please try again."
        return when {
            raw.contains("already registered", ignoreCase = true) -> "This email is already registered. Please login instead."
            raw.contains("invalid email", ignoreCase = true) -> "Please enter a valid email address."
            raw.contains("password", ignoreCase = true) -> "Password must be at least 6 characters."
            raw.contains("network", ignoreCase = true) || raw.contains("connect", ignoreCase = true) -> "No internet connection. Please check your network."
            raw.contains("Invalid login", ignoreCase = true) -> "Incorrect email or password."
            else -> "Something went wrong. Please try again."
        }
    }
    
    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _authState.value = AuthState.Idle
        }
    }

    fun refreshProfile(userId: String) {
        viewModelScope.launch {
            authRepository.getUserProfile(userId).onSuccess { profile ->
                _authState.value = AuthState.Authenticated(profile)
            }
        }
    }

    fun updateDistrict(userId: String, district: String, region: String) {
        viewModelScope.launch {
            authRepository.updateUserField(userId, mapOf("district" to district, "region" to region))
            authRepository.getUserProfile(userId).onSuccess { profile ->
                _authState.value = AuthState.Authenticated(profile)
            }
        }
    }

    fun updateEducationProfile(
        userId: String,
        educationLevel: String,
        school: String,
        combination: String,
        course: String,
        profession: String
    ) {
        viewModelScope.launch {
            authRepository.updateUserField(userId, mapOf(
                "education_level" to educationLevel,
                "school"          to school,
                "combination"     to combination,
                "course"          to course,
                "profession"      to profession
            ))
            authRepository.getUserProfile(userId).onSuccess { profile ->
                _authState.value = AuthState.Authenticated(profile)
            }
        }
    }

    fun changePassword(newPassword: String, onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            authRepository.changePassword(newPassword)
                .onSuccess { onResult(true, "Password changed successfully") }
                .onFailure { onResult(false, it.message ?: "Failed to change password") }
        }
    }

    fun sendOtp(email: String, onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            authRepository.sendOtp(email)
                .onSuccess { onResult(true, "OTP sent!") }
                .onFailure { onResult(false, it.message ?: "Failed to send OTP") }
        }
    }

    fun verifyOtp(email: String, otpCode: String, onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            authRepository.verifyOtp(email, otpCode)
                .onSuccess { onResult(true, "Verified!") }
                .onFailure { onResult(false, it.message ?: "Invalid OTP") }
        }
    }

    fun resetPasswordWithEmail(email: String, newPassword: String, onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            authRepository.resetPasswordWithEmail(email, newPassword)
                .onSuccess { onResult(true, "Password reset successfully!") }
                .onFailure { onResult(false, it.message ?: "Failed to reset password") }
        }
    }

    fun resetToIdle() {
        _authState.value = AuthState.Idle
    }

    fun clearError() {
        if (_authState.value is AuthState.Error) _authState.value = AuthState.Idle
    }
}

sealed class AuthState {
    object Idle : AuthState()
    object Loading : AuthState()
    object Registered : AuthState()
    data class Authenticated(val profile: UserProfile) : AuthState()
    data class Error(val message: String) : AuthState()
}
