package com.tutorug.app.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.data.remote.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class AuthRepository {
    private val gson = Gson()
    private val base = SupabaseClient.SUPABASE_URL
    private val http = SupabaseClient.http
    private val json = "application/json".toMediaType()

    suspend fun register(email: String, password: String, profile: UserProfile): Result<String> =
        withContext(Dispatchers.IO) {
            try {
                val authBody = gson.toJson(mapOf("email" to email, "password" to password))
                val authRequest = Request.Builder()
                    .url("$base/auth/v1/signup")
                    .post(authBody.toRequestBody(json))
                    .build()
                val authResponse = http.newCall(authRequest).execute()
                val authResponseBody = authResponse.body?.string() ?: throw Exception("Empty response")
                if (!authResponse.isSuccessful) throw Exception(parseSupabaseError(authResponseBody))

                val map = gson.fromJson<Map<String, Any>>(authResponseBody, object : TypeToken<Map<String, Any>>() {}.type)
                val userId = (map["id"] as? String)
                    ?: (map["user"] as? Map<*, *>)?.get("id") as? String
                    ?: throw Exception("Registration failed. Please try again.")

                val token = map["access_token"] as? String
                if (token != null) SupabaseClient.authToken = token

                val updatedProfile = profile.copy(userId = userId, email = email)
                insertProfile(updatedProfile).getOrThrow()
                createDefaultSettings(userId)

                Result.success(userId)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun login(email: String, password: String): Result<UserProfile> =
        withContext(Dispatchers.IO) {
            try {
                val body = gson.toJson(mapOf("email" to email, "password" to password))
                val request = Request.Builder()
                    .url("$base/auth/v1/token?grant_type=password")
                    .post(body.toRequestBody(json))
                    .build()
                val response = http.newCall(request).execute()
                val responseBody = response.body?.string() ?: throw Exception("Empty response")
                if (!response.isSuccessful) throw Exception(parseSupabaseError(responseBody))

                val map = gson.fromJson<Map<String, Any>>(responseBody, object : TypeToken<Map<String, Any>>() {}.type)
                val userId = (map["user"] as? Map<*, *>)?.get("id") as? String
                    ?: throw Exception("Login failed. Please try again.")
                SupabaseClient.authToken = map["access_token"] as? String

                // Update last_active
                updateLastActive(userId)

                val profileResult = getUserProfile(userId)
                if (profileResult.isSuccess) {
                    Result.success(profileResult.getOrNull()!!)
                } else {
                    Result.success(UserProfile(userId = userId, email = email))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun getUserProfile(userId: String): Result<UserProfile> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$base/rest/v1/users?user_id=eq.$userId&select=user_id,name,email,district,region,education_level,school,combination,course,profession,avatar_url,total_messages,total_quizzes,total_documents,streak_days,last_streak_date,created_at,last_active&limit=1")
                .get().build()
            val response = http.newCall(request).execute()
            val responseBody = response.body?.string() ?: throw Exception("Empty response")
            if (!response.isSuccessful) throw Exception(responseBody)
            val list = gson.fromJson<List<UserProfile>>(responseBody, object : TypeToken<List<UserProfile>>() {}.type)
            val profile = list.firstOrNull() ?: throw Exception("Profile not found")
            Result.success(profile)
        } catch (e: Exception) {
            android.util.Log.e("TutorUG_Auth", "getUserProfile error: ${e.message}")
            Result.failure(e)
        }
    }

    private suspend fun insertProfile(profile: UserProfile): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf(
                "user_id"         to profile.userId,
                "name"            to profile.name,
                "email"           to profile.email,
                "district"        to profile.district,
                "region"          to profile.region,
                "education_level" to profile.educationLevel,
                "school"          to profile.school,
                "combination"     to profile.combination,
                "course"          to profile.course,
                "profession"      to profile.profession,
                "avatar_url"      to profile.avatarUrl
            ))
            val request = Request.Builder()
                .url("$base/rest/v1/users")
                .addHeader("Prefer", "return=minimal")
                .post(body.toRequestBody(json))
                .build()
            val response = http.newCall(request).execute()
            val responseBody = response.body?.string()
            if (!response.isSuccessful) throw Exception(responseBody ?: "Insert failed")
            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("TutorUG_Auth", "insertProfile error: ${e.message}")
            Result.failure(e)
        }
    }

    private suspend fun createDefaultSettings(userId: String) = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf(
                "user_id"                 to userId,
                "voice_enabled"           to true,
                "auto_read_enabled"       to false,
                "quiz_sound_enabled"      to true,
                "notifications_enabled"   to true,
                "study_reminders_enabled" to true,
                "quiz_difficulty"         to "adaptive",
                "app_theme"               to "DEEP_SPACE",
                "language"                to "en",
                "updated_at"              to java.time.Instant.now().toString()
            ))
            val request = Request.Builder()
                .url("$base/rest/v1/user_settings")
                .addHeader("Prefer", "return=minimal")
                .post(body.toRequestBody(json))
                .build()
            http.newCall(request).execute()
        } catch (_: Exception) {}
    }

    private suspend fun updateLastActive(userId: String) = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf("last_active" to "now()"))
            val request = Request.Builder()
                .url("$base/rest/v1/users?user_id=eq.$userId")
                .addHeader("Prefer", "return=minimal")
                .patch(body.toRequestBody(json))
                .build()
            http.newCall(request).execute()
        } catch (_: Exception) {}
    }

    private fun parseSupabaseError(raw: String): String {
        return try {
            val map = gson.fromJson<Map<String, Any>>(raw, object : TypeToken<Map<String, Any>>() {}.type)
            (map["msg"] as? String) ?: (map["message"] as? String)
                ?: (map["error_description"] as? String) ?: raw
        } catch (e: Exception) { raw }
    }

    suspend fun sendOtp(email: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf("email" to email))
            val request = Request.Builder()
                .url("$base/functions/v1/send-otp")
                .post(body.toRequestBody(json))
                .build()
            val response = http.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            if (!response.isSuccessful) {
                val parsed = try {
                    val map = gson.fromJson<Map<String, Any>>(responseBody, object : TypeToken<Map<String, Any>>() {}.type)
                    map["error"] as? String
                } catch (_: Exception) { null }
                val userMessage = when {
                    parsed?.contains("not found", ignoreCase = true) == true ->
                        "No account found with this email address."
                    else ->
                        "You cannot reset your password yet. Please contact admin for support."
                }
                throw Exception(userMessage)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun verifyOtp(email: String, otpCode: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf("email" to email, "otp_code" to otpCode))
            val request = Request.Builder()
                .url("$base/functions/v1/verify-otp")
                .post(body.toRequestBody(json))
                .build()
            val response = http.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            if (!response.isSuccessful) throw Exception(parseSupabaseError(responseBody))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun resetPasswordWithEmail(email: String, newPassword: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf("email" to email, "new_password" to newPassword))
            val request = Request.Builder()
                .url("$base/functions/v1/reset-password")
                .post(body.toRequestBody(json))
                .build()
            val response = http.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            if (!response.isSuccessful) {
                val parsed = try {
                    val map = gson.fromJson<Map<String, Any>>(responseBody, object : TypeToken<Map<String, Any>>() {}.type)
                    map["error"] as? String
                } catch (_: Exception) { null }
                // Only show the clean user-not-found message; everything else is a server/config
                // issue the user cannot fix themselves
                val userMessage = when {
                    parsed?.contains("not found", ignoreCase = true) == true ->
                        "No account found with this email address."
                    else ->
                        "You cannot reset your password yet. Please contact admin for support."
                }
                throw Exception(userMessage)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun changePassword(newPassword: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val token = SupabaseClient.authToken ?: throw Exception("Not logged in")
            val body = gson.toJson(mapOf("password" to newPassword))
            val request = Request.Builder()
                .url("$base/auth/v1/user")
                .addHeader("Authorization", "Bearer $token")
                .put(body.toRequestBody(json))
                .build()
            val response = http.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""
            if (!response.isSuccessful) throw Exception(parseSupabaseError(responseBody))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun logout() { SupabaseClient.authToken = null }

    suspend fun updateUserField(userId: String, fields: Map<String, Any>) = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(fields)
            val request = Request.Builder()
                .url("$base/rest/v1/users?user_id=eq.$userId")
                .addHeader("Prefer", "return=minimal")
                .patch(body.toRequestBody(json))
                .build()
            http.newCall(request).execute()
        } catch (_: Exception) {}
    }

    fun isLoggedIn(): Boolean = SupabaseClient.authToken != null

    fun getCurrentUserId(): String? {
        val token = SupabaseClient.authToken ?: return null
        return try {
            val payload = token.split(".")[1]
            val decoded = String(android.util.Base64.decode(payload, android.util.Base64.URL_SAFE))
            val map = gson.fromJson<Map<String, Any>>(decoded, object : TypeToken<Map<String, Any>>() {}.type)
            map["sub"] as? String
        } catch (e: Exception) { null }
    }
}
