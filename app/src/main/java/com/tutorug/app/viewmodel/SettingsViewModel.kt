package com.tutorug.app.viewmodel

import android.app.Application
import android.content.Context
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tutorug.app.data.remote.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

enum class AppTheme(val label: String) {
    DEEP_SPACE("Deep Space"),
    MIDNIGHT("Midnight"),
    FOREST("Forest"),
    OCEAN("Ocean"),
    SUNSET("Sunset")
}

enum class QuizDifficulty(val label: String) {
    ADAPTIVE("Adaptive"),
    EASY("Easy"),
    MEDIUM("Medium"),
    HARD("Hard")
}

enum class VoiceGender { FEMALE, MALE }

class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs     = application.getSharedPreferences("tutorug_settings", Context.MODE_PRIVATE)
    private val gson      = Gson()
    private val base      = SupabaseClient.SUPABASE_URL
    private val http      = SupabaseClient.http
    private val jsonMedia = "application/json".toMediaType()

    private val _voiceEnabled          = MutableStateFlow(prefs.getBoolean("voice_enabled", true))
    private val _autoReadEnabled       = MutableStateFlow(prefs.getBoolean("auto_read", false))
    private val _quizSoundEnabled      = MutableStateFlow(prefs.getBoolean("quiz_sound", true))
    private val _notificationsEnabled  = MutableStateFlow(prefs.getBoolean("notifications", true))
    private val _studyRemindersEnabled = MutableStateFlow(prefs.getBoolean("study_reminders", true))
    private val _quizDifficulty        = MutableStateFlow(
        QuizDifficulty.valueOf(prefs.getString("quiz_difficulty", QuizDifficulty.ADAPTIVE.name)!!)
    )
    private val _appTheme              = MutableStateFlow(
        AppTheme.valueOf(prefs.getString("app_theme", AppTheme.DEEP_SPACE.name)!!)
    )
    private val _locationEnabled       = MutableStateFlow(prefs.getBoolean("location_enabled", false))
    private val _detectedDistrict      = MutableStateFlow<String?>(null)
    private val _avatarUploadState     = MutableStateFlow<AvatarUploadState>(AvatarUploadState.Idle)
    private val _speechRate            = MutableStateFlow(prefs.getFloat("speech_rate", 1.0f))
    private val _voiceGender           = MutableStateFlow(
        VoiceGender.valueOf(prefs.getString("voice_gender", VoiceGender.FEMALE.name)!!)
    )

    val voiceEnabled:          StateFlow<Boolean>         = _voiceEnabled
    val autoReadEnabled:       StateFlow<Boolean>         = _autoReadEnabled
    val quizSoundEnabled:      StateFlow<Boolean>         = _quizSoundEnabled
    val notificationsEnabled:  StateFlow<Boolean>         = _notificationsEnabled
    val studyRemindersEnabled: StateFlow<Boolean>         = _studyRemindersEnabled
    val quizDifficulty:        StateFlow<QuizDifficulty>  = _quizDifficulty
    val appTheme:              StateFlow<AppTheme>        = _appTheme
    val locationEnabled:       StateFlow<Boolean>         = _locationEnabled
    val detectedDistrict:      StateFlow<String?>         = _detectedDistrict
    val avatarUploadState:     StateFlow<AvatarUploadState> = _avatarUploadState
    val speechRate:            StateFlow<Float>           = _speechRate
    val voiceGender:           StateFlow<VoiceGender>     = _voiceGender

    // ── Avatar ───────────────────────────────────────────────────────────────

    fun uploadAvatar(userId: String, uri: Uri, onSuccess: (String) -> Unit) {
        viewModelScope.launch {
            _avatarUploadState.value = AvatarUploadState.Uploading
            try {
                val avatarUrl = withContext(Dispatchers.IO) {
                    val bytes = getApplication<Application>().contentResolver
                        .openInputStream(uri)?.readBytes()
                        ?: throw Exception("Cannot read image")
                    val mimeType = getApplication<Application>().contentResolver
                        .getType(uri) ?: "image/jpeg"
                    val ext = when {
                        mimeType.contains("png")  -> "png"
                        mimeType.contains("webp") -> "webp"
                        else -> "jpg"
                    }
                    val path = "$userId/avatar_${System.currentTimeMillis()}.$ext"
                    val uploadResp = http.newCall(
                        Request.Builder()
                            .url("${SupabaseClient.SUPABASE_URL}/storage/v1/object/avatars/$path")
                            .addHeader("x-upsert", "true")
                            .post(bytes.toRequestBody(mimeType.toMediaType()))
                            .build()
                    ).execute()
                    if (!uploadResp.isSuccessful)
                        throw Exception("Upload failed: ${uploadResp.body?.string()}")
                    "${SupabaseClient.SUPABASE_URL}/storage/v1/object/public/avatars/$path"
                }
                withContext(Dispatchers.IO) {
                    http.newCall(
                        Request.Builder()
                            .url("${SupabaseClient.SUPABASE_URL}/rest/v1/users?user_id=eq.$userId")
                            .addHeader("Prefer", "return=minimal")
                            .patch(gson.toJson(mapOf("avatar_url" to avatarUrl)).toRequestBody(jsonMedia))
                            .build()
                    ).execute()
                }
                _avatarUploadState.value = AvatarUploadState.Success(avatarUrl)
                onSuccess(avatarUrl)
            } catch (e: Exception) {
                _avatarUploadState.value = AvatarUploadState.Error(e.message ?: "Upload failed")
            }
        }
    }

    fun resetAvatarState() { _avatarUploadState.value = AvatarUploadState.Idle }

    // ── Location ─────────────────────────────────────────────────────────────

    fun setLocationEnabled(v: Boolean) {
        _locationEnabled.value = v
        prefs.edit().putBoolean("location_enabled", v).apply()
    }

    /** Reverse-geocodes lat/lng to a Uganda district name using the system Geocoder. */
    fun resolveLocationToDistrict(
        latitude: Double,
        longitude: Double,
        onResolved: (district: String, region: String) -> Unit
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val ctx = getApplication<Application>()
                @Suppress("DEPRECATION")
                val addresses = android.location.Geocoder(ctx, java.util.Locale.ENGLISH)
                    .getFromLocation(latitude, longitude, 1)
                if (!addresses.isNullOrEmpty()) {
                    val addr = addresses[0]
                    val raw = (addr.subAdminArea ?: addr.adminArea ?: "").trim()
                    val district = raw.replace(" District", "", ignoreCase = true).trim()
                    val region = addr.adminArea ?: ""
                    _detectedDistrict.value = district
                    withContext(Dispatchers.Main) { onResolved(district, region) }
                }
            } catch (_: Exception) {}
        }
    }

    // ── Setters ───────────────────────────────────────────────────────────────

    fun setVoiceEnabled(v: Boolean) {
        _voiceEnabled.value = v
        prefs.edit().putBoolean("voice_enabled", v).apply()
        syncToDb(mapOf("voice_enabled" to v))
    }

    fun setAutoReadEnabled(v: Boolean) {
        _autoReadEnabled.value = v
        prefs.edit().putBoolean("auto_read", v).apply()
        syncToDb(mapOf("auto_read_enabled" to v))
    }

    fun setQuizSoundEnabled(v: Boolean) {
        _quizSoundEnabled.value = v
        prefs.edit().putBoolean("quiz_sound", v).apply()
        syncToDb(mapOf("quiz_sound_enabled" to v))
    }

    fun setNotificationsEnabled(v: Boolean) {
        _notificationsEnabled.value = v
        prefs.edit().putBoolean("notifications", v).apply()
        syncToDb(mapOf("notifications_enabled" to v))
    }

    fun setStudyRemindersEnabled(v: Boolean) {
        _studyRemindersEnabled.value = v
        prefs.edit().putBoolean("study_reminders", v).apply()
        syncToDb(mapOf("study_reminders_enabled" to v))
    }

    fun setQuizDifficulty(v: QuizDifficulty) {
        _quizDifficulty.value = v
        prefs.edit().putString("quiz_difficulty", v.name).apply()
        syncToDb(mapOf("quiz_difficulty" to v.name.lowercase()))
    }

    fun setAppTheme(v: AppTheme) {
        _appTheme.value = v
        prefs.edit().putString("app_theme", v.name).apply()
        syncToDb(mapOf("app_theme" to v.name))
    }

    fun setSpeechRate(v: Float) {
        _speechRate.value = v
        prefs.edit().putFloat("speech_rate", v).apply()
    }

    fun setVoiceGender(v: VoiceGender) {
        _voiceGender.value = v
        prefs.edit().putString("voice_gender", v.name).apply()
    }

    // ── DB sync ───────────────────────────────────────────────────────────────

    fun loadFromDb(userId: String) {
        viewModelScope.launch {
            try {
                val s = fetchFromDb(userId) ?: return@launch
                s["voice_enabled"]?.let { v ->
                    _voiceEnabled.value = v as Boolean
                    prefs.edit().putBoolean("voice_enabled", v).apply()
                }
                s["auto_read_enabled"]?.let { v ->
                    _autoReadEnabled.value = v as Boolean
                    prefs.edit().putBoolean("auto_read", v).apply()
                }
                s["quiz_sound_enabled"]?.let { v ->
                    _quizSoundEnabled.value = v as Boolean
                    prefs.edit().putBoolean("quiz_sound", v).apply()
                }
                s["notifications_enabled"]?.let { v ->
                    _notificationsEnabled.value = v as Boolean
                    prefs.edit().putBoolean("notifications", v).apply()
                }
                s["study_reminders_enabled"]?.let { v ->
                    _studyRemindersEnabled.value = v as Boolean
                    prefs.edit().putBoolean("study_reminders", v).apply()
                }
                s["quiz_difficulty"]?.let { v ->
                    val d = QuizDifficulty.entries.firstOrNull { it.name.lowercase() == (v as String).lowercase() }
                        ?: QuizDifficulty.ADAPTIVE
                    _quizDifficulty.value = d
                    prefs.edit().putString("quiz_difficulty", d.name).apply()
                }
                s["app_theme"]?.let { v ->
                    val t = runCatching { AppTheme.valueOf(v as String) }.getOrDefault(AppTheme.DEEP_SPACE)
                    _appTheme.value = t
                    prefs.edit().putString("app_theme", t.name).apply()
                }
            } catch (_: Exception) {}
        }
    }

    private suspend fun fetchFromDb(userId: String): Map<String, Any>? = withContext(Dispatchers.IO) {
        try {
            val resp = http.newCall(
                Request.Builder()
                    .url("$base/rest/v1/user_settings?user_id=eq.$userId&limit=1")
                    .get().build()
            ).execute()
            val body = resp.body?.string() ?: return@withContext null
            val list = gson.fromJson<List<Map<String, Any>>>(body, object : TypeToken<List<Map<String, Any>>>() {}.type)
            list.firstOrNull()
        } catch (_: Exception) { null }
    }

    private fun syncToDb(fields: Map<String, Any>) {
        val userId = getCurrentUserId() ?: return
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val payload = gson.toJson(fields + mapOf(
                    "user_id"    to userId,
                    "updated_at" to java.time.Instant.now().toString()
                ))
                http.newCall(
                    Request.Builder()
                        .url("$base/rest/v1/user_settings")
                        .addHeader("Prefer", "resolution=merge-duplicates,return=minimal")
                        .post(payload.toRequestBody(jsonMedia))
                        .build()
                ).execute()
            } catch (_: Exception) {}
        }
    }

    private fun getCurrentUserId(): String? {
        val token = SupabaseClient.authToken ?: return null
        return try {
            val payload = token.split(".")[1]
            val decoded = String(android.util.Base64.decode(payload, android.util.Base64.URL_SAFE))
            val map = gson.fromJson<Map<String, Any>>(decoded, object : TypeToken<Map<String, Any>>() {}.type)
            map["sub"] as? String
        } catch (_: Exception) { null }
    }
}

sealed class AvatarUploadState {
    object Idle : AvatarUploadState()
    object Uploading : AvatarUploadState()
    data class Success(val url: String) : AvatarUploadState()
    data class Error(val message: String) : AvatarUploadState()
}
