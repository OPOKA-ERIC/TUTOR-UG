package com.tutorug.app.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tutorug.app.data.model.ChatMessage
import com.tutorug.app.data.model.ChatSession
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.data.remote.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import java.util.UUID

class ChatRepository {
    private val gson = Gson()
    private val base = SupabaseClient.SUPABASE_URL
    private val http = SupabaseClient.http
    private val json = "application/json".toMediaType()

    suspend fun createChatSession(
        userId: String,
        subject: String,
        educationLevel: String,
        documentId: String? = null
    ): String = withContext(Dispatchers.IO) {
            val sessionId = UUID.randomUUID().toString()
            val now = Instant.now().toString()
            try {
                val fields = mutableMapOf<String, Any?>(
                    "session_id"      to sessionId,
                    "user_id"         to userId,
                    "subject"         to subject,
                    "education_level" to educationLevel,
                    "title"           to subject.ifBlank { "New Chat" },
                    "message_count"   to 0,
                    "started_at"      to now,
                    "last_message_at" to now
                )
                if (documentId != null) fields["document_id"] = documentId
                val request = Request.Builder()
                    .url("$base/rest/v1/chat_sessions")
                    .addHeader("Prefer", "return=minimal")
                    .post(gson.toJson(fields).toRequestBody(json))
                    .build()
                val response = http.newCall(request).execute()
                android.util.Log.d("TutorUG_Chat", "createSession status=${response.code} body=${response.body?.string()}")
            } catch (e: Exception) {
                android.util.Log.e("TutorUG_Chat", "createSession error: ${e.message}")
            }
            sessionId
        }

    suspend fun sendMessage(
        sessionId: String,
        userMessage: String,
        userProfile: UserProfile,
        conversationHistory: List<ChatMessage>,
        districtContext: String,
        learningSection: com.tutorug.app.data.model.DocumentSection? = null,
        onToken: (String) -> Unit
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            // In learning mode, prepend section content as the first assistant message
            // so the AI always has the document context regardless of conversation length
            val historyToSend = if (learningSection != null) {
                val sectionContext = ChatMessage(
                    role = "assistant",
                    content = "We are studying: ${learningSection.title}\n\n${learningSection.content}\n\nI will answer all questions strictly based on this section content."
                )
                // Only prepend if not already there (avoid duplicating on every message)
                if (conversationHistory.firstOrNull()?.content?.contains(learningSection.title) == true) {
                    conversationHistory
                } else {
                    listOf(sectionContext) + conversationHistory
                }
            } else {
                conversationHistory
            }

            val payload = gson.toJson(mapOf(
                "sessionId"   to sessionId,
                "message"     to userMessage,
                "userProfile" to mapOf(
                    "name"           to userProfile.name,
                    "district"       to userProfile.district,
                    "educationLevel" to userProfile.educationLevel,
                    "school"         to userProfile.school,
                    "course"         to userProfile.course,
                    "profession"     to userProfile.profession,
                    "combination"    to userProfile.combination
                ),
                "districtContext"     to districtContext,
                "conversationHistory" to historyToSend.map {
                    mapOf("role" to it.role, "content" to it.content)
                },
                "learningMode"   to (learningSection != null),
                "sectionTitle"   to (learningSection?.title ?: "")
            ))

            val fnRequest = Request.Builder()
                .url("$base/functions/v1/send-chat-message")
                .post(payload.toRequestBody(json))
                .build()
            val fnResponse = http.newCall(fnRequest).execute()
            if (!fnResponse.isSuccessful) throw Exception("AI error (${fnResponse.code})")

            val source = fnResponse.body?.source() ?: throw Exception("Empty response")
            var fullResponse = ""

            // Read SSE stream line by line
            while (!source.exhausted()) {
                val line = source.readUtf8Line() ?: break
                if (!line.startsWith("data: ")) continue
                val data = line.removePrefix("data: ").trim()
                if (data.isEmpty()) continue

                val map = gson.fromJson<Map<String, Any>>(data, object : TypeToken<Map<String, Any>>() {}.type)
                when {
                    map["token"] != null -> {
                        val token = map["token"] as String
                        fullResponse += token
                        onToken(token)
                    }
                    map["done"] == true -> {
                        fullResponse = map["response"] as? String ?: fullResponse
                    }
                    map["error"] != null -> throw Exception(map["error"] as String)
                }
            }

            // Persist both messages
            saveMessage(sessionId, userProfile.userId, "user", userMessage)
            saveMessage(sessionId, userProfile.userId, "assistant", fullResponse)
            updateSessionStats(sessionId)
            updateUserMessageCount(userProfile.userId)

            Result.success(fullResponse)
        } catch (e: Exception) {
            android.util.Log.e("TutorUG_Chat", "sendMessage error: ${e.message}")
            Result.failure(e)
        }
    }

    suspend fun saveMessagePublic(sessionId: String, userId: String, role: String, content: String) =
        saveMessage(sessionId, userId, role, content)

    suspend fun updateSessionSectionIndex(sessionId: String, sectionIndex: Int) = withContext(Dispatchers.IO) {
        try {
            http.newCall(Request.Builder()
                .url("$base/rest/v1/chat_sessions?session_id=eq.$sessionId")
                .addHeader("Prefer", "return=minimal")
                .patch(gson.toJson(mapOf("section_index" to sectionIndex)).toRequestBody(json))
                .build()).execute()
        } catch (e: Exception) {
            android.util.Log.w("TutorUG_Chat", "updateSessionSectionIndex error: ${e.message}")
        }
    }

    suspend fun updateSectionProgress(documentId: String, sectionIndex: Int, passed: Boolean, score: Int) =
        withContext(Dispatchers.IO) {
            try {
                // Fetch current best_score first
                val getResp = http.newCall(Request.Builder()
                    .url("$base/rest/v1/document_sections?document_id=eq.$documentId&section_index=eq.$sectionIndex&select=best_score,attempt_count&limit=1")
                    .get().build()).execute()
                val getBody = getResp.body?.string() ?: return@withContext
                val list = gson.fromJson<List<Map<String, Any>>>(getBody, object : TypeToken<List<Map<String, Any>>>() {}.type)
                val currentBest = (list.firstOrNull()?.get("best_score") as? Double)?.toInt() ?: 0
                val attempts = (list.firstOrNull()?.get("attempt_count") as? Double)?.toInt() ?: 0
                http.newCall(Request.Builder()
                    .url("$base/rest/v1/document_sections?document_id=eq.$documentId&section_index=eq.$sectionIndex")
                    .addHeader("Prefer", "return=minimal")
                    .patch(gson.toJson(mapOf(
                        "quiz_passed"   to (passed || currentBest >= 70),
                        "best_score"    to maxOf(score, currentBest),
                        "attempt_count" to attempts + 1
                    )).toRequestBody(json))
                    .build()).execute()
            } catch (e: Exception) {
                android.util.Log.w("TutorUG_Chat", "updateSectionProgress error: ${e.message}")
            }
        }

    private suspend fun saveMessage(sessionId: String, userId: String, role: String, content: String) =
        withContext(Dispatchers.IO) {
            try {
                val body = gson.toJson(mapOf(
                    "message_id" to UUID.randomUUID().toString(),
                    "session_id" to sessionId,
                    "user_id"    to userId,
                    "role"       to role,
                    "content"    to content,
                    "created_at" to Instant.now().toString()
                ))
                val request = Request.Builder()
                    .url("$base/rest/v1/chat_messages")
                    .addHeader("Prefer", "return=minimal")
                    .post(body.toRequestBody(json))
                    .build()
                val resp = http.newCall(request).execute()
                android.util.Log.d("TutorUG_Chat", "saveMessage[$role] status=${resp.code}")
            } catch (e: Exception) {
                android.util.Log.w("TutorUG_Chat", "saveMessage error: ${e.message}")
            }
        }

    // Patch last_message_at and increment message_count directly — no RPC needed
    private suspend fun updateSessionStats(sessionId: String) = withContext(Dispatchers.IO) {
        try {
            // First fetch current count
            val getReq = Request.Builder()
                .url("$base/rest/v1/chat_sessions?session_id=eq.$sessionId&select=message_count&limit=1")
                .get().build()
            val getResp = http.newCall(getReq).execute()
            val getBody = getResp.body?.string() ?: return@withContext
            val list = gson.fromJson<List<Map<String, Any>>>(getBody, object : TypeToken<List<Map<String, Any>>>() {}.type)
            val currentCount = (list.firstOrNull()?.get("message_count") as? Double)?.toInt() ?: 0

            val patchBody = gson.toJson(mapOf(
                "last_message_at" to Instant.now().toString(),
                "message_count"   to currentCount + 2
            ))
            val patchReq = Request.Builder()
                .url("$base/rest/v1/chat_sessions?session_id=eq.$sessionId")
                .addHeader("Prefer", "return=minimal")
                .patch(patchBody.toRequestBody(json))
                .build()
            http.newCall(patchReq).execute()
        } catch (e: Exception) {
            android.util.Log.w("TutorUG_Chat", "updateSessionStats error: ${e.message}")
        }
    }

    // Fetch current total_messages and increment by 2
    private suspend fun updateUserMessageCount(userId: String) = withContext(Dispatchers.IO) {
        try {
            val getReq = Request.Builder()
                .url("$base/rest/v1/users?user_id=eq.$userId&select=total_messages&limit=1")
                .get().build()
            val getResp = http.newCall(getReq).execute()
            val getBody = getResp.body?.string() ?: return@withContext
            val list = gson.fromJson<List<Map<String, Any>>>(getBody, object : TypeToken<List<Map<String, Any>>>() {}.type)
            val current = (list.firstOrNull()?.get("total_messages") as? Double)?.toInt() ?: 0

            val patchBody = gson.toJson(mapOf("total_messages" to current + 2))
            val patchReq = Request.Builder()
                .url("$base/rest/v1/users?user_id=eq.$userId")
                .addHeader("Prefer", "return=minimal")
                .patch(patchBody.toRequestBody(json))
                .build()
            http.newCall(patchReq).execute()
        } catch (e: Exception) {
            android.util.Log.w("TutorUG_Chat", "updateUserMessageCount error: ${e.message}")
        }
    }

    suspend fun deleteSession(sessionId: String, userId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            // Delete messages first (cascade should handle it but being explicit)
            http.newCall(Request.Builder()
                .url("$base/rest/v1/chat_messages?session_id=eq.$sessionId&user_id=eq.$userId")
                .delete()
                .build()).execute()
            // Delete the session
            val resp = http.newCall(Request.Builder()
                .url("$base/rest/v1/chat_sessions?session_id=eq.$sessionId&user_id=eq.$userId")
                .delete()
                .build()).execute()
            if (!resp.isSuccessful) throw Exception("Delete failed: ${resp.code}")
            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("TutorUG_Chat", "deleteSession error: ${e.message}")
            Result.failure(e)
        }
    }

    /** Regular chats only — no document_id. Shown in the chat screen sidebar. */
    suspend fun getChatHistory(userId: String): List<ChatSession> = withContext(Dispatchers.IO) {
        fetchSessions(userId, learningOnly = false)
    }

    /** Learning sessions only — have a document_id. Shown on the upload page. */
    suspend fun getLearningHistory(userId: String): List<ChatSession> = withContext(Dispatchers.IO) {
        fetchSessions(userId, learningOnly = true)
    }

    private suspend fun fetchSessions(userId: String, learningOnly: Boolean): List<ChatSession> =
        withContext(Dispatchers.IO) {
            try {
                // PostgREST null filter syntax: is.null / not.is.null
                val nullFilter = if (learningOnly) "document_id=not.is.null" else "document_id=is.null"
                val request = Request.Builder()
                    .url("$base/rest/v1/chat_sessions?user_id=eq.$userId&$nullFilter&order=last_message_at.desc&limit=50")
                    .get().build()
                val response = http.newCall(request).execute()
                val body = response.body?.string() ?: return@withContext emptyList()
                if (!response.isSuccessful) {
                    android.util.Log.e("TutorUG_Chat", "fetchSessions($learningOnly) failed: $body")
                    // If the column doesn't exist yet, fall back to fetching all sessions
                    // for regular chat history so the sidebar is never empty
                    if (!learningOnly) return@withContext fetchAllSessions(userId)
                    return@withContext emptyList()
                }
                val sessions = gson.fromJson<List<ChatSession>>(body, object : TypeToken<List<ChatSession>>() {}.type)
                    ?: return@withContext emptyList()
                sessions.map { session ->
                    val msgs = getSessionMessages(session.sessionId, limit = 2)
                    session.copy(messages = msgs)
                }
            } catch (e: Exception) {
                android.util.Log.e("TutorUG_Chat", "fetchSessions error: ${e.message}")
                if (!learningOnly) fetchAllSessions(userId) else emptyList()
            }
        }

    /** Fallback: fetch all sessions without null filter (used when document_id column is missing). */
    private suspend fun fetchAllSessions(userId: String): List<ChatSession> =
        withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("$base/rest/v1/chat_sessions?user_id=eq.$userId&order=last_message_at.desc&limit=50")
                    .get().build()
                val response = http.newCall(request).execute()
                val body = response.body?.string() ?: return@withContext emptyList()
                if (!response.isSuccessful) return@withContext emptyList()
                val sessions = gson.fromJson<List<ChatSession>>(body, object : TypeToken<List<ChatSession>>() {}.type)
                    ?: return@withContext emptyList()
                sessions.map { session ->
                    val msgs = getSessionMessages(session.sessionId, limit = 2)
                    session.copy(messages = msgs)
                }
            } catch (e: Exception) { emptyList() }
        }

    suspend fun getSession(sessionId: String, userId: String): ChatSession? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$base/rest/v1/chat_sessions?session_id=eq.$sessionId&user_id=eq.$userId&limit=1")
                .get().build()
            val response = http.newCall(request).execute()
            val body = response.body?.string() ?: return@withContext null
            val list = gson.fromJson<List<ChatSession>>(body, object : TypeToken<List<ChatSession>>() {}.type)
            val session = list.firstOrNull() ?: return@withContext null
            val messages = getSessionMessages(sessionId, userId = userId)
            session.copy(messages = messages)
        } catch (e: Exception) { null }
    }

    suspend fun getSessionMessages(sessionId: String, limit: Int = 200, userId: String = ""): List<ChatMessage> =
        withContext(Dispatchers.IO) {
            try {
                val userFilter = if (userId.isNotBlank()) "&user_id=eq.$userId" else ""
                val request = Request.Builder()
                    .url("$base/rest/v1/chat_messages?session_id=eq.$sessionId$userFilter&order=created_at.asc&limit=$limit")
                    .get().build()
                val response = http.newCall(request).execute()
                val body = response.body?.string() ?: return@withContext emptyList()
                if (!response.isSuccessful) return@withContext emptyList()
                gson.fromJson(body, object : TypeToken<List<ChatMessage>>() {}.type) ?: emptyList()
            } catch (e: Exception) { emptyList() }
        }
}
