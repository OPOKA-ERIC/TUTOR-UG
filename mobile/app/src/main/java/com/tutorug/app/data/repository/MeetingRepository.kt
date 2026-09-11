package com.tutorug.app.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tutorug.app.data.model.Meeting
import com.tutorug.app.data.model.MeetingInvite
import com.tutorug.app.data.model.MeetingParticipant
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

    private fun jitsiUrl(meetingId: String): String {
        val room = meetingId.take(8)
        return "https://meet.jit.si/tutorug-$room#config.prejoinPageEnabled=false&config.requireDisplayName=false&config.disableDeepLinking=true&interfaceConfig.disableDeepLinking=true"
    }

    suspend fun loadMeetings(): List<Meeting> = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$base/rest/v1/meetings?status=in.(\"scheduled\",\"live\")&order=scheduled_at.asc")
            .get().build()
        val body = http.newCall(req).execute().body?.string() ?: return@withContext emptyList()
        gson.fromJson(body, object : TypeToken<List<Meeting>>() {}.type) ?: emptyList()
    }

    suspend fun loadInvitedMeetings(userId: String): List<Meeting> = withContext(Dispatchers.IO) {
        val inviteReq = Request.Builder()
            .url("$base/rest/v1/meeting_invites?user_id=eq.$userId&status=in.(\"pending\",\"accepted\")&select=meeting_id")
            .get().build()
        val inviteBody = http.newCall(inviteReq).execute().body?.string() ?: return@withContext emptyList()
        val inviteList = gson.fromJson<List<Map<String, String>>>(inviteBody, object : TypeToken<List<Map<String, String>>>() {}.type)
        val ids = inviteList?.mapNotNull { it["meeting_id"] } ?: return@withContext emptyList()
        if (ids.isEmpty()) return@withContext emptyList()
        val idsParam = ids.joinToString(",") { "\"$it\"" }
        val req = Request.Builder()
            .url("$base/rest/v1/meetings?meeting_id=in.($idsParam)&status=in.(\"scheduled\",\"live\")")
            .get().build()
        val body = http.newCall(req).execute().body?.string() ?: return@withContext emptyList()
        gson.fromJson(body, object : TypeToken<List<Meeting>>() {}.type) ?: emptyList()
    }

    suspend fun createMeeting(
        meetingId: String, hostId: String, title: String, subject: String,
        description: String, scheduledAt: String, durationMins: Int, hostName: String
    ): Triple<String, String, String> = withContext(Dispatchers.IO) {
        val payload = JSONObject().apply {
            put("meetingId", meetingId); put("hostId", hostId); put("title", title)
            put("subject", subject); put("scheduledAt", scheduledAt); put("durationMins", durationMins)
            put("userName", hostName)
        }
        val edgeReq = Request.Builder()
            .url("$base/functions/v1/create-meeting")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()
        val edgeBody = http.newCall(edgeReq).execute().body?.string() ?: "{}"
        val edgeJson = JSONObject(edgeBody)
        val roomUrl = edgeJson.optString("roomUrl", jitsiUrl(meetingId))
        val hostToken = edgeJson.optString("hostToken", "")
        val participantToken = edgeJson.optString("participantToken", "")

        val row = JSONObject().apply {
            put("meeting_id", meetingId); put("host_id", hostId); put("title", title)
            put("subject", subject); put("description", description); put("room_url", roomUrl)
            put("room_token", hostToken); put("scheduled_at", scheduledAt)
            put("duration_mins", durationMins); put("status", "scheduled")
            put("host_name", hostName)
            put("created_at", java.time.Instant.now().toString())
        }
        val insertReq = Request.Builder()
            .url("$base/rest/v1/meetings")
            .post(row.toString().toRequestBody("application/json".toMediaType()))
            .build()
        http.newCall(insertReq).execute()

        Triple(roomUrl, hostToken, participantToken)
    }

    suspend fun deleteMeeting(meetingId: String) = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$base/rest/v1/meetings?meeting_id=eq.$meetingId")
            .delete().build()
        http.newCall(req).execute()
    }

    suspend fun getParticipantToken(meetingId: String, userId: String, meeting: Meeting, userName: String): String =
        withContext(Dispatchers.IO) {
            val checkReq = Request.Builder()
                .url("$base/rest/v1/meeting_participants?meeting_id=eq.$meetingId&user_id=eq.$userId&select=join_token,status")
                .get().build()
            val checkBody = http.newCall(checkReq).execute().body?.string() ?: "[]"
            val existing = gson.fromJson<List<Map<String, String>>>(checkBody, object : TypeToken<List<Map<String, String>>>() {}.type)
            val existingToken = existing?.firstOrNull()?.get("join_token")
            val existingStatus = existing?.firstOrNull()?.get("status")

            if (existingStatus == "refused") throw Exception("Your join request was refused by the host")
            if (existingStatus == "pending") throw Exception("Your join request is pending host approval")
            if (!existingToken.isNullOrBlank()) return@withContext existingToken

            val payload = JSONObject().apply {
                put("meetingId", meetingId); put("hostId", meeting.hostId); put("title", meeting.title)
                put("subject", meeting.subject); put("scheduledAt", meeting.scheduledAt)
                put("durationMins", meeting.durationMins); put("userName", userName)
            }
            val edgeReq = Request.Builder()
                .url("$base/functions/v1/create-meeting")
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .build()
            val edgeBody = http.newCall(edgeReq).execute().body?.string() ?: "{}"
            val token = JSONObject(edgeBody).optString("participantToken", "")

            val upsert = JSONObject().apply {
                put("meeting_id", meetingId); put("user_id", userId)
                put("join_token", token); put("status", "approved")
                put("joined_at", java.time.Instant.now().toString())
            }
            val upsertReq = Request.Builder()
                .url("$base/rest/v1/meeting_participants")
                .header("Prefer", "resolution=merge-duplicates")
                .post(upsert.toString().toRequestBody("application/json".toMediaType()))
                .build()
            http.newCall(upsertReq).execute()
            token
        }

    suspend fun requestJoin(meetingId: String, userId: String) = withContext(Dispatchers.IO) {
        val upsert = JSONObject().apply {
            put("meeting_id", meetingId); put("user_id", userId)
            put("join_token", ""); put("status", "pending")
            put("joined_at", java.time.Instant.now().toString())
        }
        val req = Request.Builder()
            .url("$base/rest/v1/meeting_participants")
            .header("Prefer", "resolution=merge-duplicates")
            .post(upsert.toString().toRequestBody("application/json".toMediaType()))
            .build()
        http.newCall(req).execute()
    }

    suspend fun loadParticipants(meetingId: String): List<MeetingParticipant> = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$base/rest/v1/meeting_participants?meeting_id=eq.$meetingId&order=joined_at.asc")
            .get().build()
        val body = http.newCall(req).execute().body?.string() ?: return@withContext emptyList()
        gson.fromJson(body, object : TypeToken<List<MeetingParticipant>>() {}.type) ?: emptyList()
    }

    suspend fun approveParticipant(participantId: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().put("status", "approved").toString()
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder()
            .url("$base/rest/v1/meeting_participants?id=eq.$participantId")
            .patch(body).build()
        http.newCall(req).execute()
    }

    suspend fun refuseParticipant(participantId: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().put("status", "refused").toString()
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder()
            .url("$base/rest/v1/meeting_participants?id=eq.$participantId")
            .patch(body).build()
        http.newCall(req).execute()
    }

    suspend fun sendInvites(meetingId: String, emails: List<String>, hostName: String) = withContext(Dispatchers.IO) {
        val payload = JSONObject().apply {
            put("meetingId", meetingId)
            put("hostName", hostName)
            put("emails", org.json.JSONArray(emails.toTypedArray()))
        }
        val req = Request.Builder()
            .url("${SupabaseClient.SUPABASE_URL.replace("https://jsjhgwficdrgzwbwzkhm.supabase.co", "http://localhost:3001/api")}/invite-to-meeting")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()
        // Fallback: use Supabase Edge Function if backend not available
        try {
            http.newCall(req).execute()
        } catch (e: Exception) {
            val edgePayload = JSONObject().apply {
                put("meetingId", meetingId)
                put("hostName", hostName)
                put("emails", org.json.JSONArray(emails.toTypedArray()))
            }
            val edgeReq = Request.Builder()
                .url("$base/functions/v1/invite-to-meeting")
                .post(edgePayload.toString().toRequestBody("application/json".toMediaType()))
                .build()
            http.newCall(edgeReq).execute()
        }
    }

    suspend fun loadInvites(meetingId: String): List<MeetingInvite> = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$base/rest/v1/meeting_invites?meeting_id=eq.$meetingId&order=invited_at.asc")
            .get().build()
        val body = http.newCall(req).execute().body?.string() ?: return@withContext emptyList()
        gson.fromJson(body, object : TypeToken<List<MeetingInvite>>() {}.type) ?: emptyList()
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
