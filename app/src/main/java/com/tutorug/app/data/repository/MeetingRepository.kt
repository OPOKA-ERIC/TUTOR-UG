package com.tutorug.app.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tutorug.app.data.model.Meeting
import com.tutorug.app.data.remote.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class MeetingRepository {
    private val gson = Gson()
    private val base = SupabaseClient.SUPABASE_URL
    private val http = SupabaseClient.http

    suspend fun loadMeetings(): List<Meeting> = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$base/rest/v1/meetings?status=in.(\"scheduled\",\"live\")&order=scheduled_at.asc")
            .get().build()
        val body = http.newCall(req).execute().body?.string() ?: return@withContext emptyList()
        gson.fromJson(body, object : TypeToken<List<Meeting>>() {}.type) ?: emptyList()
    }

    suspend fun createMeeting(
        meetingId: String, hostId: String, title: String, subject: String,
        description: String, scheduledAt: String, durationMins: Int
    ): Triple<String, String, String> = withContext(Dispatchers.IO) {
        // 1. Call edge function to get Daily room
        val payload = JSONObject().apply {
            put("meetingId", meetingId); put("hostId", hostId); put("title", title)
            put("subject", subject); put("scheduledAt", scheduledAt); put("durationMins", durationMins)
        }
        val edgeReq = Request.Builder()
            .url("$base/functions/v1/create-meeting")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()
        val edgeBody = http.newCall(edgeReq).execute().body?.string() ?: "{}"
        val edgeJson = JSONObject(edgeBody)
        val roomUrl = edgeJson.optString("roomUrl", "https://tutorug.daily.co/$meetingId")
        val hostToken = edgeJson.optString("hostToken", "host_$meetingId")
        val participantToken = edgeJson.optString("participantToken", "join_$meetingId")

        // 2. Insert into DB
        val row = JSONObject().apply {
            put("meeting_id", meetingId); put("host_id", hostId); put("title", title)
            put("subject", subject); put("description", description); put("room_url", roomUrl)
            put("room_token", hostToken); put("scheduled_at", scheduledAt)
            put("duration_mins", durationMins); put("status", "scheduled")
            put("created_at", java.time.Instant.now().toString())
        }
        val insertReq = Request.Builder()
            .url("$base/rest/v1/meetings")
            .post(row.toString().toRequestBody("application/json".toMediaType()))
            .build()
        http.newCall(insertReq).execute()

        Triple(roomUrl, hostToken, participantToken)
    }

    suspend fun getParticipantToken(meetingId: String, userId: String, meeting: Meeting): String =
        withContext(Dispatchers.IO) {
            // Check existing
            val checkReq = Request.Builder()
                .url("$base/rest/v1/meeting_participants?meeting_id=eq.$meetingId&user_id=eq.$userId&select=join_token")
                .get().build()
            val checkBody = http.newCall(checkReq).execute().body?.string() ?: "[]"
            val existing = gson.fromJson<List<Map<String, String>>>(checkBody, object : TypeToken<List<Map<String, String>>>() {}.type)
            val existingToken = existing?.firstOrNull()?.get("join_token")
            if (!existingToken.isNullOrBlank()) return@withContext existingToken

            // Get new token from edge function
            val payload = JSONObject().apply {
                put("meetingId", meetingId); put("hostId", meeting.hostId); put("title", meeting.title)
                put("subject", meeting.subject); put("scheduledAt", meeting.scheduledAt); put("durationMins", meeting.durationMins)
            }
            val edgeReq = Request.Builder()
                .url("$base/functions/v1/create-meeting")
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .build()
            val edgeBody = http.newCall(edgeReq).execute().body?.string() ?: "{}"
            val token = JSONObject(edgeBody).optString("participantToken", "join_$meetingId")

            // Upsert participant record
            val upsert = JSONObject().apply {
                put("meeting_id", meetingId); put("user_id", userId)
                put("join_token", token); put("joined_at", java.time.Instant.now().toString())
            }
            val upsertReq = Request.Builder()
                .url("$base/rest/v1/meeting_participants")
                .header("Prefer", "resolution=merge-duplicates")
                .post(upsert.toString().toRequestBody("application/json".toMediaType()))
                .build()
            http.newCall(upsertReq).execute()
            token
        }

    suspend fun updateStatus(meetingId: String, status: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().put("status", status).toString()
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder()
            .url("$base/rest/v1/meetings?meeting_id=eq.$meetingId")
            .patch(body).build()
        http.newCall(req).execute()
    }
}
