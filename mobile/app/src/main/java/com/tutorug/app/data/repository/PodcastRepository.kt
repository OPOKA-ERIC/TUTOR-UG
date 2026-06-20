package com.tutorug.app.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tutorug.app.data.model.PodcastSegment
import com.tutorug.app.data.model.PodcastSession
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.data.remote.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

class PodcastRepository {
    private val gson = Gson()
    private val base = SupabaseClient.SUPABASE_URL
    private val http = SupabaseClient.http

    suspend fun generatePodcast(
        topic: String,
        userProfile: UserProfile,
        conversationHistory: List<Map<String, String>>
    ): List<PodcastSegment> = withContext(Dispatchers.IO) {
        val historyArray = JSONArray()
        conversationHistory.forEach { entry ->
            historyArray.put(JSONObject().apply {
                put("role", entry["role"]); put("content", entry["content"])
            })
        }
        val payload = JSONObject().apply {
            put("topic", topic)
            put("userProfile", JSONObject().apply {
                put("name", userProfile.name)
                put("district", userProfile.district)
                put("educationLevel", userProfile.educationLevel)
            })
            put("districtContext", "Student: ${userProfile.name}, District: ${userProfile.district}")
            put("conversationHistory", historyArray)
        }
        val req = Request.Builder()
            .url("$base/functions/v1/generate-podcast")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()
        val body = http.newCall(req).execute().body?.string() ?: return@withContext emptyList()
        val scriptJson = JSONObject(body).optJSONArray("script") ?: return@withContext emptyList()
        val result = mutableListOf<PodcastSegment>()
        for (i in 0 until scriptJson.length()) {
            val seg = scriptJson.getJSONObject(i)
            result.add(PodcastSegment(speaker = seg.optString("speaker", "HOST"), text = seg.optString("text", "")))
        }
        result
    }

    suspend fun saveSession(session: PodcastSession) = withContext(Dispatchers.IO) {
        val scriptJson = gson.toJson(session.script)
        val row = JSONObject().apply {
            put("podcast_id", session.podcastId); put("user_id", session.userId)
            put("topic", session.topic); put("subject", session.subject)
            put("education_level", session.educationLevel)
            put("script", scriptJson); put("duration_secs", session.durationSecs)
            put("created_at", session.createdAt)
        }
        val req = Request.Builder()
            .url("$base/rest/v1/podcast_sessions")
            .post(row.toString().toRequestBody("application/json".toMediaType()))
            .build()
        http.newCall(req).execute()
    }

    suspend fun loadHistory(userId: String): List<PodcastSession> = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$base/rest/v1/podcast_sessions?user_id=eq.$userId&order=created_at.desc&limit=10")
            .get().build()
        val body = http.newCall(req).execute().body?.string() ?: return@withContext emptyList()
        val arr = JSONArray(body.ifBlank { "[]" })
        val result = mutableListOf<PodcastSession>()
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            val rawScript = obj.optString("script", "[]")
            val segments: List<PodcastSegment> = try {
                gson.fromJson(rawScript, object : TypeToken<List<PodcastSegment>>() {}.type) ?: emptyList()
            } catch (_: Exception) { emptyList() }
            result.add(PodcastSession(
                podcastId = obj.optString("podcast_id"),
                userId = obj.optString("user_id"),
                topic = obj.optString("topic"),
                subject = obj.optString("subject"),
                educationLevel = obj.optString("education_level"),
                script = segments,
                durationSecs = obj.optInt("duration_secs"),
                createdAt = obj.optString("created_at")
            ))
        }
        result
    }
}
