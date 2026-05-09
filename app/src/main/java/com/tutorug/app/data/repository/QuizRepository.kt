package com.tutorug.app.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tutorug.app.data.model.QuizQuestion
import com.tutorug.app.data.model.QuizResult
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.data.remote.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import java.util.UUID

class QuizRepository {
    private val gson = Gson()
    private val base = SupabaseClient.SUPABASE_URL
    private val http = SupabaseClient.http
    private val json = "application/json".toMediaType()

    suspend fun generateQuiz(
        sectionContent: String,
        userProfile: UserProfile,
        districtContext: String
    ): Result<List<QuizQuestion>> = withContext(Dispatchers.IO) {
        try {
            val payload = gson.toJson(mapOf(
                "sectionContent" to sectionContent,
                "userProfile" to mapOf(
                    "name"           to userProfile.name,
                    "district"       to userProfile.district,
                    "educationLevel" to userProfile.educationLevel
                ),
                "districtContext" to districtContext
            ))
            val request = Request.Builder()
                .url("$base/functions/v1/generate-quiz")
                .post(payload.toRequestBody(json))
                .build()
            val response = http.newCall(request).execute()
            val body = response.body?.string() ?: throw Exception("Empty response")
            if (!response.isSuccessful) throw Exception(body)

            val map = gson.fromJson<Map<String, Any>>(body, object : TypeToken<Map<String, Any>>() {}.type)
            val questionsRaw = map["questions"] as? List<*> ?: throw Exception("No questions returned")

            val questions = questionsRaw.mapNotNull { item ->
                val q = item as? Map<*, *> ?: return@mapNotNull null
                try {
                    QuizQuestion(
                        question     = q["question"] as? String ?: return@mapNotNull null,
                        options      = (q["options"] as? List<*>)?.filterIsInstance<String>() ?: return@mapNotNull null,
                        correctIndex = (q["correctIndex"] as? Double)?.toInt() ?: return@mapNotNull null,
                        explanation  = q["explanation"] as? String ?: ""
                    )
                } catch (e: Exception) { null }
            }
            Result.success(questions)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun saveQuizResult(result: QuizResult) = withContext(Dispatchers.IO) {
        try {
            val body = gson.toJson(mapOf(
                "quiz_id"         to UUID.randomUUID().toString(),
                "user_id"         to result.userId,
                "document_id"     to result.documentId,
                "section_id"      to result.sectionId,
                "section_title"   to result.sectionTitle,
                "subject"         to result.subject,
                "education_level" to result.educationLevel,
                "score"           to result.score,
                "total_questions" to result.totalQuestions,
                "correct_answers" to result.correctAnswers,
                "passed"          to result.passed,
                "difficulty"      to result.difficulty,
                "time_taken_sec"  to result.timeTakenSec,
                "taken_at"        to Instant.now().toString()
            ))
            val request = Request.Builder()
                .url("$base/rest/v1/quiz_results")
                .addHeader("Prefer", "return=minimal")
                .post(body.toRequestBody(json))
                .build()
            val resp = http.newCall(request).execute()
            android.util.Log.d("TutorUG_Quiz", "saveQuizResult status=${resp.code}")
            // Increment user total_quizzes
            incrementUserQuizzes(result.userId)
        } catch (e: Exception) {
            android.util.Log.e("TutorUG_Quiz", "saveQuizResult error: ${e.message}")
        }
    }

    private suspend fun incrementUserQuizzes(userId: String) {
        try {
            val getResp = http.newCall(Request.Builder()
                .url("$base/rest/v1/users?user_id=eq.$userId&select=total_quizzes&limit=1")
                .get().build()).execute()
            val getBody = getResp.body?.string() ?: return
            val list = gson.fromJson<List<Map<String, Any>>>(getBody, object : TypeToken<List<Map<String, Any>>>() {}.type)
            val current = (list.firstOrNull()?.get("total_quizzes") as? Double)?.toInt() ?: 0
            http.newCall(Request.Builder()
                .url("$base/rest/v1/users?user_id=eq.$userId")
                .addHeader("Prefer", "return=minimal")
                .patch(gson.toJson(mapOf("total_quizzes" to current + 1)).toRequestBody(json))
                .build()).execute()
        } catch (_: Exception) {}
    }

    suspend fun getUserQuizResults(userId: String): List<QuizResult> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$base/rest/v1/quiz_results?user_id=eq.$userId&order=taken_at.desc&limit=100")
                .get().build()
            val response = http.newCall(request).execute()
            val body = response.body?.string() ?: return@withContext emptyList()
            if (!response.isSuccessful) return@withContext emptyList()
            gson.fromJson<List<QuizResult>>(body, object : TypeToken<List<QuizResult>>() {}.type) ?: emptyList()
        } catch (e: Exception) { emptyList() }
    }
}
