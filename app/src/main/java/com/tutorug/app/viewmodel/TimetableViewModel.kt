package com.tutorug.app.viewmodel

import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tutorug.app.data.model.TimetableEntry
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.data.model.InsightType
import com.tutorug.app.data.model.QuizResult
import com.tutorug.app.data.model.StudyInsight
import com.tutorug.app.data.model.StudySessionLog
import com.tutorug.app.data.repository.StudySessionRepository
import com.tutorug.app.data.repository.TimetableRepository
import com.tutorug.app.util.TimetableAlarmReceiver
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.Calendar

class TimetableViewModel(application: Application) : AndroidViewModel(application) {

    private val repo        = TimetableRepository()
    private val sessionRepo  = StudySessionRepository()

    private val _entries = MutableStateFlow<List<TimetableEntry>>(emptyList())
    val entries: StateFlow<List<TimetableEntry>> = _entries

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _insights = MutableStateFlow<List<StudyInsight>>(emptyList())
    val insights: StateFlow<List<StudyInsight>> = _insights

    // Tracks when the app entered a session window (entryId -> startTimeMillis)
    private val activeSessionStart = mutableMapOf<String, Long>()

    fun load(userId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _entries.value = repo.getEntries(userId)
            _isLoading.value = false
            refreshInsights(userId)
        }
    }

    fun addEntry(entry: TimetableEntry, profile: UserProfile) {
        viewModelScope.launch {
            val result = repo.addEntry(entry)
            result.onSuccess { saved ->
                _entries.value = (_entries.value + saved)
                    .sortedWith(compareBy({ it.dayOfWeek }, { it.startHour }, { it.startMin }))
                scheduleAlarms(saved, profile)
            }.onFailure { e ->
                android.util.Log.e("TutorUG_Timetable", "addEntry failed: ${e.message}")
                _error.value = when {
                    e.message?.contains("42P01") == true ->
                        "Timetable table not set up. Please run the SQL setup in Supabase."
                    e.message?.contains("401") == true ->
                        "Not authorised. Please log out and log back in."
                    e.message?.contains("network", ignoreCase = true) == true ->
                        "No internet connection. Check your network and try again."
                    else -> "Failed to save: ${e.message}"
                }
            }
        }
    }

    fun deleteEntry(entryId: String) {
        viewModelScope.launch {
            repo.deleteEntry(entryId)
            _entries.value = _entries.value.filter { it.entryId != entryId }
            cancelAlarms(entryId)
        }
    }

    fun updateEntry(entry: TimetableEntry, profile: UserProfile) {
        viewModelScope.launch {
            val ok = repo.updateEntry(entry)
            if (ok) {
                _entries.value = _entries.value.map { if (it.entryId == entry.entryId) entry else it }
                    .sortedWith(compareBy({ it.dayOfWeek }, { it.startHour }, { it.startMin }))
                cancelAlarms(entry.entryId)
                scheduleAlarms(entry, profile)
            } else {
                _error.value = "Failed to update entry"
            }
        }
    }

    /**
     * Returns a warning message if [subject] appears more than [maxPerDay] times
     * on any single day, or more than [maxPerWeek] times across the whole week.
     * Returns null if everything is fine.
     * [excludeEntryId] lets us ignore the entry being edited so it doesn't count itself.
     */
    fun overScheduleWarning(
        subject: String,
        excludeEntryId: String = "",
        maxPerDay: Int = 2,
        maxPerWeek: Int = 5
    ): String? {
        val relevant = _entries.value.filter { it.subject == subject && it.entryId != excludeEntryId }
        val weekCount = relevant.size
        if (weekCount >= maxPerWeek)
            return "⚠️ $subject is already scheduled $weekCount time(s) this week (max $maxPerWeek)."
        val worstDay = relevant.groupBy { it.dayOfWeek }.maxByOrNull { it.value.size }
        if (worstDay != null && worstDay.value.size >= maxPerDay) {
            val dayName = listOf("Mon","Tue","Wed","Thu","Fri","Sat","Sun")[worstDay.key - 1]
            return "⚠️ $subject already has ${worstDay.value.size} session(s) on $dayName (max $maxPerDay per day)."
        }
        return null
    }

    fun dismissError() { _error.value = null }

    // ── Study session tracking ────────────────────────────────────────────────

    /**
     * Called from MainActivity.onResume — checks if any timetable entry is
     * currently active and starts tracking attended time.
     */
    fun onAppResumed(userId: String) {
        val now = Calendar.getInstance()
        val todayDow = now.get(Calendar.DAY_OF_WEEK).let {
            // Calendar: Sun=1,Mon=2..Sat=7 → our: Mon=1..Sun=7
            if (it == Calendar.SUNDAY) 7 else it - 1
        }
        val nowMins = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        _entries.value.filter { it.dayOfWeek == todayDow }.forEach { entry ->
            val startMins = entry.startHour * 60 + entry.startMin
            val endMins   = entry.endHour   * 60 + entry.endMin
            val halfMins  = startMins + (endMins - startMins) / 2
            // Only count if within the session window and past the halfway mark
            if (nowMins in startMins..endMins) {
                if (!activeSessionStart.containsKey(entry.entryId)) {
                    activeSessionStart[entry.entryId] = System.currentTimeMillis()
                }
            }
        }
    }

    /**
     * Called from MainActivity.onPause — saves attended minutes for any active session.
     */
    fun onAppPaused(userId: String) {
        val now = Calendar.getInstance()
        val todayDow = now.get(Calendar.DAY_OF_WEEK).let {
            if (it == Calendar.SUNDAY) 7 else it - 1
        }
        val dateStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
            .format(java.util.Date())
        activeSessionStart.forEach { (entryId, startMs) ->
            val elapsedMins = ((System.currentTimeMillis() - startMs) / 60000).toInt().coerceAtLeast(1)
            val entry = _entries.value.find { it.entryId == entryId } ?: return@forEach
            viewModelScope.launch {
                sessionRepo.addAttendedMins(userId, entryId, dateStr, elapsedMins)
                refreshInsights(userId)
            }
        }
        activeSessionStart.clear()
    }

    fun refreshInsights(userId: String) {
        viewModelScope.launch {
            val logs = sessionRepo.getLogs(userId)
            _insights.value = computeInsights(_entries.value, logs)
        }
    }

    fun loadInsightsWithQuizScores(userId: String, quizResults: List<QuizResult>) {
        viewModelScope.launch {
            val logs = sessionRepo.getLogs(userId)
            _insights.value = computeInsights(_entries.value, logs, quizResults)
        }
    }

    private fun computeInsights(
        entries: List<TimetableEntry>,
        logs: List<StudySessionLog>,
        quizResults: List<QuizResult> = emptyList()
    ): List<StudyInsight> {
        val insights = mutableListOf<StudyInsight>()
        val today = Calendar.getInstance()
        val todayDow = today.get(Calendar.DAY_OF_WEEK).let {
            if (it == Calendar.SUNDAY) 7 else it - 1
        }
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())

        // Look back over the last 7 days
        for (daysBack in 0..6) {
            val cal = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -daysBack) }
            val dateStr = sdf.format(cal.time)
            val dow = cal.get(Calendar.DAY_OF_WEEK).let {
                if (it == Calendar.SUNDAY) 7 else it - 1
            }
            val dayEntries = entries.filter { it.dayOfWeek == dow }
            dayEntries.forEach { entry ->
                val log = logs.find { it.entryId == entry.entryId && it.dateStr == dateStr }
                val scheduledMins = (entry.endHour * 60 + entry.endMin) - (entry.startHour * 60 + entry.startMin)
                val attendedMins  = log?.attendedMins ?: 0
                val alarmFired    = log?.alarmFired ?: false
                val halfMins      = scheduledMins / 2

                // Average quiz score for this subject
                val subjectScores = quizResults.filter {
                    it.subject.equals(entry.subject, ignoreCase = true)
                }
                val avgScore = if (subjectScores.isEmpty()) -1
                              else subjectScores.map { it.score }.average().toInt()

                // Skip today if alarm hasn't fired yet — no data yet
                if (daysBack == 0 && !alarmFired) return@forEach

                val (type, recommendation) = when {
                    // Alarm fired, attended >= half time, score >= 70 → GOOD
                    alarmFired && attendedMins >= halfMins && (avgScore < 0 || avgScore >= 70) ->
                        InsightType.GOOD to buildGoodMessage(entry.subject, attendedMins, scheduledMins, avgScore)

                    // Alarm fired, attended >= half time, but score < 70 → needs more time
                    alarmFired && attendedMins >= halfMins && avgScore in 0..69 ->
                        InsightType.NEEDS_MORE_TIME to buildLowScoreMessage(entry.subject, attendedMins, scheduledMins, avgScore)

                    // Alarm fired but attended < half time → needs more time
                    alarmFired && attendedMins < halfMins ->
                        InsightType.NEEDS_MORE_TIME to buildLowTimeMessage(entry.subject, attendedMins, scheduledMins, avgScore)

                    // Alarm fired but app never opened → missed
                    alarmFired && attendedMins == 0 ->
                        InsightType.MISSED to buildMissedMessage(entry.subject, scheduledMins, avgScore)

                    // Alarm never fired (past day) → missed
                    !alarmFired && daysBack > 0 ->
                        InsightType.MISSED to buildMissedMessage(entry.subject, scheduledMins, avgScore)

                    else -> return@forEach
                }

                insights.add(
                    StudyInsight(
                        entryId       = entry.entryId,
                        subject       = entry.subject,
                        dayOfWeek     = dow,
                        dateStr       = dateStr,
                        type          = type,
                        attendedMins  = attendedMins,
                        scheduledMins = scheduledMins,
                        avgScore      = avgScore.coerceAtLeast(0),
                        recommendation = recommendation
                    )
                )
            }
        }
        // ── Condition 3: Morning vs Afternoon study-time advice ─────────────
        // Morning = startHour < 12, Afternoon = startHour >= 12
        val morningLogs  = logs.filter { log ->
            val entry = entries.find { it.entryId == log.entryId }
            entry != null && entry.startHour < 12 && log.attendedMins > 0
        }
        val afternoonLogs = logs.filter { log ->
            val entry = entries.find { it.entryId == log.entryId }
            entry != null && entry.startHour >= 12 && log.attendedMins > 0
        }
        if (morningLogs.size >= 2 || afternoonLogs.size >= 2) {
            val avgMorningAttendance = if (morningLogs.isEmpty()) 0.0
                else morningLogs.map { it.attendedMins.toDouble() / it.scheduledMins.coerceAtLeast(1) }.average()
            val avgAfternoonAttendance = if (afternoonLogs.isEmpty()) 0.0
                else afternoonLogs.map { it.attendedMins.toDouble() / it.scheduledMins.coerceAtLeast(1) }.average()

            val morningQuizAvg = if (quizResults.isEmpty()) -1 else {
                val morningSubjects = morningLogs.map { log -> entries.find { it.entryId == log.entryId }?.subject ?: "" }.toSet()
                val scores = quizResults.filter { it.subject in morningSubjects }.map { it.score }
                if (scores.isEmpty()) -1 else scores.average().toInt()
            }
            val afternoonQuizAvg = if (quizResults.isEmpty()) -1 else {
                val afternoonSubjects = afternoonLogs.map { log -> entries.find { it.entryId == log.entryId }?.subject ?: "" }.toSet()
                val scores = quizResults.filter { it.subject in afternoonSubjects }.map { it.score }
                if (scores.isEmpty()) -1 else scores.average().toInt()
            }

            val advice = buildStudyTimeAdvice(avgMorningAttendance, avgAfternoonAttendance, morningQuizAvg, afternoonQuizAvg)
            if (advice != null) {
                insights.add(
                    StudyInsight(
                        entryId        = "study_time_advice",
                        subject        = "Study Time Insight",
                        dayOfWeek      = 0,
                        dateStr        = sdf.format(today.time),
                        type           = InsightType.STUDY_TIME_ADVICE,
                        attendedMins   = 0,
                        scheduledMins  = 0,
                        avgScore       = 0,
                        recommendation = advice
                    )
                )
            }
        }

        return insights.sortedByDescending { it.dateStr }
    }

    private fun buildGoodMessage(subject: String, attended: Int, scheduled: Int, score: Int): String {
        val scoreStr = if (score >= 0) " and scored $score% on quizzes" else ""
        return "✅ Great work on $subject! You studied $attended/$scheduled mins$scoreStr. Keep it up!"
    }

    private fun buildLowScoreMessage(subject: String, attended: Int, scheduled: Int, score: Int): String =
        "📊 You spent $attended/$scheduled mins on $subject but scored $score% on quizzes (below 70%). " +
        "You are attending but not fully grasping the content — try reviewing notes, asking the AI tutor more questions, or redoing quizzes."

    private fun buildLowTimeMessage(subject: String, attended: Int, scheduled: Int, score: Int): String {
        val scoreStr = if (score >= 0) " Your quiz average is $score%." else ""
        return "⏰ You only spent $attended of your $scheduled scheduled mins on $subject.$scoreStr " +
        "Try to stay in the app for the full session — even half the time makes a big difference."
    }

    private fun buildMissedMessage(subject: String, scheduled: Int, score: Int): String {
        val scoreStr = if (score in 0..69) " Your quiz average is $score% which is below 70%."
                       else if (score >= 70) " Your quiz average is $score% — good, but consistency matters."
                       else ""
        return "❌ You missed your $subject session ($scheduled mins scheduled).$scoreStr " +
        "Missing sessions regularly will hurt your understanding. Try to reschedule or add an extra session this week."
    }

    private fun buildStudyTimeAdvice(
        morningRate: Double,
        afternoonRate: Double,
        morningQuiz: Int,
        afternoonQuiz: Int
    ): String? {
        val hasMorning   = morningRate > 0
        val hasAfternoon = afternoonRate > 0
        if (!hasMorning && !hasAfternoon) return null

        val morningPct   = (morningRate * 100).toInt()
        val afternoonPct = (afternoonRate * 100).toInt()
        val diff         = morningPct - afternoonPct

        return when {
            // Strong morning preference (attendance + quiz)
            hasMorning && hasAfternoon && diff >= 20 && (morningQuiz < 0 || morningQuiz >= afternoonQuiz) ->
                "🌅 You attend $morningPct% of morning sessions vs $afternoonPct% of afternoon sessions. " +
                "You clearly study better in the morning — try to schedule your hardest subjects before noon."

            // Strong afternoon preference
            hasMorning && hasAfternoon && diff <= -20 && (afternoonQuiz < 0 || afternoonQuiz >= morningQuiz) ->
                "🌇 You attend $afternoonPct% of afternoon sessions vs $morningPct% of morning sessions. " +
                "You perform better in the afternoon — consider moving difficult subjects to after lunch."

            // Morning attendance good but quiz scores low in afternoon
            hasMorning && hasAfternoon && morningQuiz >= 0 && afternoonQuiz in 0..59 && morningQuiz > afternoonQuiz + 10 ->
                "📚 Your quiz scores are higher for morning sessions ($morningQuiz%) than afternoon ($afternoonQuiz%). " +
                "Consider reducing afternoon study load and focusing on revision or lighter topics after noon."

            // Only morning data
            hasMorning && !hasAfternoon && morningPct >= 70 ->
                "🌅 You've been consistent with morning sessions ($morningPct% attendance). Keep scheduling study time in the morning — it's working for you!"

            // Only afternoon data
            !hasMorning && hasAfternoon && afternoonPct >= 70 ->
                "🌇 You've been consistent with afternoon sessions ($afternoonPct% attendance). Your afternoon study habit is strong — keep it up!"

            // Both similar — no strong preference yet
            hasMorning && hasAfternoon && kotlin.math.abs(diff) < 20 ->
                "⚖️ Your morning ($morningPct%) and afternoon ($afternoonPct%) attendance are similar. " +
                "Keep tracking — once a pattern emerges, we'll advise you on your best study window."

            else -> null
        }
    }

    // ── Alarm scheduling ──────────────────────────────────────────────────────

    private fun scheduleAlarms(entry: TimetableEntry, profile: UserProfile) {
        val ctx = getApplication<Application>()
        val alarmManager = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        // Schedule for the next 4 weeks so it repeats weekly
        repeat(4) { week ->
            val startCal = nextOccurrence(entry.dayOfWeek, entry.startHour, entry.startMin, weekOffset = week)
            val reminderCal = (startCal.clone() as Calendar).apply { add(Calendar.MINUTE, -15) }

            // 15-min reminder alarm
            if (reminderCal.timeInMillis > System.currentTimeMillis()) {
                val reminderIntent = buildIntent(ctx, entry, profile, isReminder = true)
                val reminderPi = PendingIntent.getBroadcast(
                    ctx,
                    reminderId(entry.entryId, week),
                    reminderIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminderCal.timeInMillis, reminderPi)
            }

            // Start-time alarm
            if (startCal.timeInMillis > System.currentTimeMillis()) {
                val startIntent = buildIntent(ctx, entry, profile, isReminder = false)
                val startPi = PendingIntent.getBroadcast(
                    ctx,
                    alarmId(entry.entryId, week),
                    startIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, startCal.timeInMillis, startPi)
            }
        }
    }

    private fun cancelAlarms(entryId: String) {
        val ctx = getApplication<Application>()
        val alarmManager = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        repeat(4) { week ->
            listOf(alarmId(entryId, week), reminderId(entryId, week)).forEach { reqCode ->
                val pi = PendingIntent.getBroadcast(
                    ctx, reqCode,
                    Intent(ctx, TimetableAlarmReceiver::class.java),
                    PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
                )
                pi?.let { alarmManager.cancel(it) }
            }
        }
    }

    private fun buildIntent(ctx: Context, entry: TimetableEntry, profile: UserProfile, isReminder: Boolean) =
        Intent(ctx, TimetableAlarmReceiver::class.java).apply {
            putExtra("entry_id",       entry.entryId)
            putExtra("subject",        entry.subject)
            putExtra("start_hour",     entry.startHour)
            putExtra("start_min",      entry.startMin)
            putExtra("is_reminder",    isReminder)
            putExtra("user_id",        profile.userId)
            putExtra("day_of_week",    entry.dayOfWeek)
            putExtra("scheduled_mins", (entry.endHour * 60 + entry.endMin) - (entry.startHour * 60 + entry.startMin))
        }

    private fun nextOccurrence(dayOfWeek: Int, hour: Int, min: Int, weekOffset: Int = 0): Calendar {
        // dayOfWeek: 1=Mon…7=Sun → Calendar: Mon=2…Sun=1
        val calDay = if (dayOfWeek == 7) Calendar.SUNDAY else dayOfWeek + 1
        return Calendar.getInstance().apply {
            set(Calendar.DAY_OF_WEEK, calDay)
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, min)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.WEEK_OF_YEAR, 1)
            add(Calendar.WEEK_OF_YEAR, weekOffset)
        }
    }

    private fun alarmId(entryId: String, week: Int)    = (entryId.hashCode() and 0x7FFFFFFF) + week * 10000
    private fun reminderId(entryId: String, week: Int) = (entryId.hashCode() and 0x7FFFFFFF) + week * 10000 + 5000
}
