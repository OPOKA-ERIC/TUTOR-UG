package com.tutorug.app.util

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.tutorug.app.data.remote.SupabaseClient
import com.tutorug.app.data.repository.TimetableRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.Calendar

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != "android.intent.action.QUICKBOOT_POWERON") return

        val token = SupabaseClient.authToken ?: return
        val userId = extractUserId(token) ?: return

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val entries = TimetableRepository().getEntries(userId)
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

                entries.forEach { entry ->
                    repeat(4) { week ->
                        val startCal = nextOccurrence(entry.dayOfWeek, entry.startHour, entry.startMin, week)
                        val reminderCal = (startCal.clone() as Calendar).apply {
                            add(Calendar.MINUTE, -15)
                        }

                        // Reminder alarm
                        if (reminderCal.timeInMillis > System.currentTimeMillis()) {
                            val ri = Intent(context, TimetableAlarmReceiver::class.java).apply {
                                putExtra("subject",     entry.subject)
                                putExtra("start_hour",  entry.startHour)
                                putExtra("start_min",   entry.startMin)
                                putExtra("is_reminder", true)
                            }
                            val rPi = PendingIntent.getBroadcast(
                                context,
                                reminderId(entry.entryId, week),
                                ri,
                                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                            )
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminderCal.timeInMillis, rPi)
                        }

                        // Start alarm
                        if (startCal.timeInMillis > System.currentTimeMillis()) {
                            val si = Intent(context, TimetableAlarmReceiver::class.java).apply {
                                putExtra("subject",     entry.subject)
                                putExtra("start_hour",  entry.startHour)
                                putExtra("start_min",   entry.startMin)
                                putExtra("is_reminder", false)
                            }
                            val sPi = PendingIntent.getBroadcast(
                                context,
                                alarmId(entry.entryId, week),
                                si,
                                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                            )
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, startCal.timeInMillis, sPi)
                        }
                    }
                }
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun nextOccurrence(dayOfWeek: Int, hour: Int, min: Int, weekOffset: Int): Calendar {
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

    private fun extractUserId(token: String): String? = try {
        val payload = token.split(".")[1]
        val decoded = String(android.util.Base64.decode(payload, android.util.Base64.URL_SAFE))
        val map = com.google.gson.Gson().fromJson(decoded, Map::class.java)
        map["sub"] as? String
    } catch (_: Exception) { null }
}
