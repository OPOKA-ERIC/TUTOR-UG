package com.tutorug.app.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tutorug.app.data.model.StudySessionLog
import com.tutorug.app.data.remote.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.UUID

class StudySessionRepository {

    private val base = SupabaseClient.SUPABASE_URL
    private val http = SupabaseClient.http
    private val gson = Gson()
    private val json = "application/json".toMediaType()

    /** Insert or update a session log for a specific entry + date. */
    suspend fun upsertLog(log: StudySessionLog): Boolean = withContext(Dispatchers.IO) {
        try {
            val payload = gson.toJson(mapOf(
                "log_id"          to log.logId.ifBlank { UUID.randomUUID().toString() },
                "user_id"         to log.userId,
                "entry_id"        to log.entryId,
                "subject"         to log.subject,
                "day_of_week"     to log.dayOfWeek,
                "scheduled_mins"  to log.scheduledMins,
                "attended_mins"   to log.attendedMins,
                "alarm_fired"     to log.alarmFired,
                "date_str"        to log.dateStr,
                "created_at"      to java.time.Instant.now().toString()
            ))
            val resp = http.newCall(
                Request.Builder()
                    .url("$base/rest/v1/study_session_logs")
                    .addHeader("Prefer", "resolution=merge-duplicates,return=minimal")
                    .post(payload.toRequestBody(json))
                    .build()
            ).execute()
            resp.isSuccessful
        } catch (_: Exception) { false }
    }

    /** Add attended minutes to an existing log (called while app is open during session). */
    suspend fun addAttendedMins(userId: String, entryId: String, dateStr: String, addMins: Int) = withContext(Dispatchers.IO) {
        try {
            // Fetch existing log first
            val resp = http.newCall(
                Request.Builder()
                    .url("$base/rest/v1/study_session_logs?user_id=eq.$userId&entry_id=eq.$entryId&date_str=eq.$dateStr&limit=1")
                    .get().build()
            ).execute()
            val body = resp.body?.string() ?: return@withContext
            val list: List<StudySessionLog> = gson.fromJson(body, object : TypeToken<List<StudySessionLog>>() {}.type)
            val existing = list.firstOrNull() ?: return@withContext
            val newMins = (existing.attendedMins + addMins).coerceAtMost(existing.scheduledMins)
            http.newCall(
                Request.Builder()
                    .url("$base/rest/v1/study_session_logs?log_id=eq.${existing.logId}")
                    .addHeader("Prefer", "return=minimal")
                    .patch(gson.toJson(mapOf("attended_mins" to newMins)).toRequestBody(json))
                    .build()
            ).execute()
        } catch (_: Exception) {}
    }

    suspend fun getLogs(userId: String): List<StudySessionLog> = withContext(Dispatchers.IO) {
        try {
            val resp = http.newCall(
                Request.Builder()
                    .url("$base/rest/v1/study_session_logs?user_id=eq.$userId&order=date_str.desc&limit=90")
                    .get().build()
            ).execute()
            val body = resp.body?.string() ?: return@withContext emptyList()
            gson.fromJson(body, object : TypeToken<List<StudySessionLog>>() {}.type) ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }
}
