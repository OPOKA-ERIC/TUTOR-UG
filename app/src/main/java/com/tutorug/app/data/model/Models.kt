package com.tutorug.app.data.model

import com.google.gson.annotations.SerializedName

// ── users ─────────────────────────────────────────────────────────────────────
data class UserProfile(
    @SerializedName("user_id")          val userId: String = "",
    @SerializedName("name")             val name: String = "",
    @SerializedName("email")            val email: String = "",
    @SerializedName("district")         val district: String = "",
    @SerializedName("region")           val region: String = "",
    @SerializedName("education_level")  val educationLevel: String = "",
    @SerializedName("school")           val school: String = "",
    @SerializedName("combination")      val combination: String = "",
    @SerializedName("course")           val course: String = "",
    @SerializedName("profession")       val profession: String = "",
    @SerializedName("avatar_url")       val avatarUrl: String = "",
    @SerializedName("created_at")       val createdAt: String = "",
    @SerializedName("last_active")      val lastActive: String = "",
    @SerializedName("total_messages")   val totalMessages: Int = 0,
    @SerializedName("total_quizzes")    val totalQuizzes: Int = 0,
    @SerializedName("total_documents")  val totalDocuments: Int = 0,
    @SerializedName("streak_days")      val streakDays: Int = 0,
    @SerializedName("last_streak_date") val lastStreakDate: String? = null
)

// ── chat_sessions ─────────────────────────────────────────────────────────────
data class ChatSession(
    @SerializedName("session_id")       val sessionId: String = "",
    @SerializedName("user_id")          val userId: String = "",
    @SerializedName("subject")          val subject: String = "",
    @SerializedName("education_level")  val educationLevel: String = "",
    @SerializedName("title")            val title: String = "",
    @SerializedName("message_count")    val messageCount: Int = 0,
    @SerializedName("started_at")       val startedAt: String = "",
    @SerializedName("last_message_at")  val lastMessageAt: String = "",
    @SerializedName("document_id")      val documentId: String? = null,
    @SerializedName("section_index")    val sectionIndex: Int = 0,
    // In-memory only — not stored in this table (fetched from chat_messages)
    @Transient val messages: List<ChatMessage> = emptyList()
)

// ── chat_messages ─────────────────────────────────────────────────────────────
data class ChatMessage(
    @SerializedName("message_id")   val messageId: String = "",
    @SerializedName("session_id")   val sessionId: String = "",
    @SerializedName("user_id")      val userId: String = "",
    @SerializedName("role")         val role: String = "user",
    @SerializedName("content")      val content: String = "",
    @SerializedName("token_count")  val tokenCount: Int = 0,
    @SerializedName("created_at")   val createdAt: String = ""
)

// ── documents ─────────────────────────────────────────────────────────────────
data class UploadedDocument(
    @SerializedName("document_id")    val documentId: String = "",
    @SerializedName("user_id")        val userId: String = "",
    @SerializedName("file_name")      val fileName: String = "",
    @SerializedName("storage_url")    val storageURL: String = "",
    @SerializedName("mime_type")      val mimeType: String = "application/octet-stream",
    @SerializedName("file_size_kb")   val fileSizeKb: Int = 0,
    @SerializedName("subject")        val subject: String = "",
    @SerializedName("education_level") val educationLevel: String = "",
    @SerializedName("status")         val status: String = "processing",
    @SerializedName("overall_score")  val overallScore: Int = 0,
    @SerializedName("section_count")  val sectionCount: Int = 0,
    @SerializedName("uploaded_at")    val uploadedAt: String = "",
    @SerializedName("processed_at")   val processedAt: String? = null
)

// ── document_sections ─────────────────────────────────────────────────────────
data class DocumentSection(
    @SerializedName("section_id")     val sectionId: String = "",
    @SerializedName("document_id")    val documentId: String = "",
    @SerializedName("user_id")        val userId: String = "",
    @SerializedName("section_index")  val sectionIndex: Int = 0,
    @SerializedName("title")          val title: String = "",
    @SerializedName("content")        val content: String = "",
    @SerializedName("quiz_passed")    val quizPassed: Boolean = false,
    @SerializedName("best_score")     val bestScore: Int = 0,
    @SerializedName("attempt_count")  val attemptCount: Int = 0,
    @SerializedName("created_at")     val createdAt: String = ""
)

// ── quiz_results ──────────────────────────────────────────────────────────────
data class QuizResult(
    @SerializedName("quiz_id")          val quizId: String = "",
    @SerializedName("user_id")          val userId: String = "",
    @SerializedName("document_id")      val documentId: String? = null,
    @SerializedName("section_id")       val sectionId: String? = null,
    @SerializedName("section_title")    val sectionTitle: String = "",
    @SerializedName("subject")          val subject: String = "",
    @SerializedName("education_level")  val educationLevel: String = "",
    @SerializedName("score")            val score: Int = 0,
    @SerializedName("total_questions")  val totalQuestions: Int = 0,
    @SerializedName("correct_answers")  val correctAnswers: Int = 0,
    @SerializedName("passed")           val passed: Boolean = false,
    @SerializedName("difficulty")       val difficulty: String = "adaptive",
    @SerializedName("time_taken_sec")   val timeTakenSec: Int = 0,
    @SerializedName("taken_at")         val takenAt: String = ""
)

// ── quiz_questions (AI-generated, not stored in DB) ───────────────────────────
data class QuizQuestion(
    @SerializedName("question")       val question: String = "",
    @SerializedName("options")        val options: List<String> = emptyList(),
    @SerializedName("correct_index")  val correctIndex: Int = 0,
    @SerializedName("explanation")    val explanation: String = ""
)

// ── study_session_logs ────────────────────────────────────────────────────────────
data class StudySessionLog(
    @SerializedName("log_id")         val logId: String = "",
    @SerializedName("user_id")        val userId: String = "",
    @SerializedName("entry_id")       val entryId: String = "",
    @SerializedName("subject")        val subject: String = "",
    @SerializedName("day_of_week")    val dayOfWeek: Int = 1,
    @SerializedName("scheduled_mins") val scheduledMins: Int = 0,   // total session length
    @SerializedName("attended_mins")  val attendedMins: Int = 0,    // mins app was open in window
    @SerializedName("alarm_fired")    val alarmFired: Boolean = false,
    @SerializedName("date_str")       val dateStr: String = "",     // "YYYY-MM-DD"
    @SerializedName("created_at")     val createdAt: String = ""
)

// ── study insights (computed locally, not stored) ────────────────────────────
enum class InsightType { GOOD, NEEDS_MORE_TIME, MISSED, NO_DATA, STUDY_TIME_ADVICE }

data class StudyInsight(
    val entryId: String,
    val subject: String,
    val dayOfWeek: Int,
    val dateStr: String,          // which specific date this insight is for
    val type: InsightType,
    val attendedMins: Int,
    val scheduledMins: Int,
    val avgScore: Int,            // average quiz score for this subject (0 if none)
    val recommendation: String    // human-readable advice
)

// ── timetable_entries ────────────────────────────────────────────────────────
data class TimetableEntry(
    @SerializedName("entry_id")    val entryId: String = "",
    @SerializedName("user_id")     val userId: String = "",
    @SerializedName("subject")     val subject: String = "",
    @SerializedName("day_of_week") val dayOfWeek: Int = 1,   // 1=Mon … 7=Sun
    @SerializedName("start_hour")  val startHour: Int = 8,
    @SerializedName("start_min")   val startMin: Int = 0,
    @SerializedName("end_hour")    val endHour: Int = 9,
    @SerializedName("end_min")     val endMin: Int = 0,
    @SerializedName("color_hex")   val colorHex: String = "#FFC107",
    @SerializedName("created_at")  val createdAt: String = ""
)

// ── user_settings ─────────────────────────────────────────────────────────────
data class UserSettings(
    @SerializedName("user_id")                  val userId: String = "",
    @SerializedName("voice_enabled")            val voiceEnabled: Boolean = true,
    @SerializedName("auto_read_enabled")        val autoReadEnabled: Boolean = false,
    @SerializedName("quiz_sound_enabled")       val quizSoundEnabled: Boolean = true,
    @SerializedName("notifications_enabled")    val notificationsEnabled: Boolean = true,
    @SerializedName("study_reminders_enabled")  val studyRemindersEnabled: Boolean = true,
    @SerializedName("quiz_difficulty")          val quizDifficulty: String = "adaptive",
    @SerializedName("app_theme")                val appTheme: String = "DEEP_SPACE",
    @SerializedName("language")                 val language: String = "en",
    @SerializedName("updated_at")               val updatedAt: String = ""
)

// ── local only (district JSON, not in DB) ─────────────────────────────────────
data class DistrictData(
    val name: String = "",
    val region: String = "",
    val places: List<String> = emptyList(),
    val localNames: List<String> = emptyList(),
    val landmarks: List<String> = emptyList(),
    val rivers: List<String> = emptyList(),
    val foods: List<String> = emptyList(),
    val economy: List<String> = emptyList(),
    val animals: List<String> = emptyList()
)
