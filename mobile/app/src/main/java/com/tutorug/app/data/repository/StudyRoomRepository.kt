package com.tutorug.app.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tutorug.app.data.model.RoomMessage
import com.tutorug.app.data.model.StudyRoom
import com.tutorug.app.data.remote.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class StudyRoomRepository {
    private val gson = Gson()
    private val base = SupabaseClient.SUPABASE_URL
    private val http = SupabaseClient.http

    suspend fun loadRooms(): List<StudyRoom> = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$base/rest/v1/study_rooms?order=subject.asc")
            .get().build()
        val body = http.newCall(req).execute().body?.string() ?: return@withContext emptyList()
        gson.fromJson(body, object : TypeToken<List<StudyRoom>>() {}.type) ?: emptyList()
    }

    suspend fun loadMessages(roomId: String): List<RoomMessage> = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$base/rest/v1/room_messages?room_id=eq.$roomId&flagged=eq.false&order=created_at.asc&limit=100")
            .get().build()
        val body = http.newCall(req).execute().body?.string() ?: return@withContext emptyList()
        gson.fromJson(body, object : TypeToken<List<RoomMessage>>() {}.type) ?: emptyList()
    }

    suspend fun moderateAndSend(
        roomId: String, userId: String, userName: String, userAvatar: String,
        content: String, subject: String
    ): Boolean = withContext(Dispatchers.IO) {
        // Moderate
        val modPayload = JSONObject().apply {
            put("message", content); put("subject", subject); put("userName", userName)
        }
        val modReq = Request.Builder()
            .url("$base/functions/v1/moderate-message")
            .post(modPayload.toString().toRequestBody("application/json".toMediaType()))
            .build()
        val modBody = http.newCall(modReq).execute().body?.string() ?: "{\"allowed\":true}"
        val allowed = JSONObject(modBody).optBoolean("allowed", true)
        if (!allowed) return@withContext false

        // Insert message
        val row = JSONObject().apply {
            put("room_id", roomId); put("user_id", userId); put("user_name", userName)
            put("user_avatar", userAvatar); put("content", content); put("flagged", false)
            put("created_at", java.time.Instant.now().toString())
        }
        val insertReq = Request.Builder()
            .url("$base/rest/v1/room_messages")
            .post(row.toString().toRequestBody("application/json".toMediaType()))
            .build()
        http.newCall(insertReq).execute()
        true
    }
}
