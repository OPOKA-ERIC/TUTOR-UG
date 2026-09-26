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

    // Whether the most recent generatePodcast call actually sent notes. The UI
    // uses this so it never claims to be "grounded" when nothing was found.
    @Volatile
    var lastHadSources: Boolean = false
        private set

    /**
     * Pull real text out of the learner's own uploaded notes so the episode is
     * grounded in their material instead of generic model knowledge. This is
     * the difference between a podcast that knows the student and one that does not.
     */
    private suspend fun loadSourceMaterial(
        userId: String,
        topic: String
    ): String = withContext(Dispatchers.IO) {
        try {
            val sections = JSONArray(
                http.newCall(
                    Request.Builder()
                        .url("$base/rest/v1/document_sections?user_id=eq.$userId&select=title,content,section_index&order=section_index&limit=60")
                        .get().build()
                ).execute().body?.string() ?: return@withContext ""
            )
            if (sections.length() == 0) return@withContext ""

            val words = topic.trim().split(Regex("\\s+")).filter { it.length > 3 }
            val scored = (0 until sections.length()).map { i ->
                val o = sections.getJSONObject(i)
                val title = o.optString("title", "")
                val content = o.optString("content", "")
                val hay = "$title $content".lowercase()
                // Rank sections that share vocabulary with the requested topic.
                val score = words.count { hay.contains(it.lowercase()) } +
                    if (title.lowercase().containsAny(words)) 3 else 0
                Triple(score, title, content)
            }.sortedByDescending { it.first }

            val relevant = if (scored.first().first > 0) scored.take(8) else scored.take(4)
            val sb = StringBuilder()
            for ((_, title, content) in relevant) {
                if (content.isBlank()) continue
                val trimmed = if (content.length > 1400) content.take(1400) + " ..." else content
                sb.append("- ").append(title.ifBlank { "Untitled section" }).append(": ")
                  .append(trimmed.replace(Regex("\\s+"), " ")).append("\n")
                if (sb.length > 9000) break
            }
            sb.toString()
        } catch (_: Exception) {
            ""
        }
    }

    private fun String.containsAny(words: List<String>): Boolean = words.any { contains(it.lowercase()) }

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
        val sourceMaterial = loadSourceMaterial(userProfile.userId, topic)
        lastHadSources = sourceMaterial.isNotBlank()
        val payload = JSONObject().apply {
            put("topic", topic)
            put("userProfile", JSONObject().apply {
                put("name", userProfile.name)
                put("district", userProfile.district)
                put("educationLevel", userProfile.educationLevel)
            })
            put("districtContext", "Student: ${userProfile.name}, District: ${userProfile.district}")
            put("conversationHistory", historyArray)
            if (sourceMaterial.isNotBlank()) put("sourceMaterial", sourceMaterial)
        }
        val req = Request.Builder()
            .url("$base/functions/v1/generate-podcast")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()
        val body = http.newCall(req).execute().body?.string() ?: return@withContext emptyList()
        val err = runCatching { JSONObject(body).optString("error") }.getOrNull()
        if (!err.isNullOrBlank()) return@withContext emptyList()
        val scriptJson = JSONObject(body).optJSONArray("script") ?: return@withContext emptyList()
        val result = mutableListOf<PodcastSegment>()
        for (i in 0 until scriptJson.length()) {
            val seg = scriptJson.getJSONObject(i)
            val speaker = seg.optString("speaker", "HOST").uppercase()
            val text = seg.optString("text", "").trim()
            if (text.isNotBlank()) {
                result.add(PodcastSegment(speaker = speaker, text = text))
            }
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
