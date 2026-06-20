package com.tutorug.app.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat
import com.tutorug.app.MainActivity
import com.tutorug.app.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class TimetableAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val subject    = intent.getStringExtra("subject") ?: return
        val startHour  = intent.getIntExtra("start_hour", 0)
        val startMin   = intent.getIntExtra("start_min", 0)
        val isReminder = intent.getBooleanExtra("is_reminder", false)
        val email      = intent.getStringExtra("email") ?: ""
        val name       = intent.getStringExtra("name") ?: "Student"
        val startTime  = "%02d:%02d".format(startHour, startMin)

        if (isReminder) {
            // 15-min before: heads-up notification only
            showReminderNotification(context, subject, startTime)
        } else {
            // Start time: log alarm fired, then launch full-screen alarm
            val entryId = intent.getStringExtra("entry_id") ?: ""
            val userId  = intent.getStringExtra("user_id") ?: ""
            val dayOfWeek = intent.getIntExtra("day_of_week", 1)
            val scheduledMins = intent.getIntExtra("scheduled_mins", 0)
            if (entryId.isNotBlank() && userId.isNotBlank()) {
                val dateStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
                    .format(java.util.Date())
                val pendingResult = goAsync()
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        com.tutorug.app.data.repository.StudySessionRepository().upsertLog(
                            com.tutorug.app.data.model.StudySessionLog(
                                userId        = userId,
                                entryId       = entryId,
                                subject       = subject,
                                dayOfWeek     = dayOfWeek,
                                scheduledMins = scheduledMins,
                                attendedMins  = 0,
                                alarmFired    = true,
                                dateStr       = dateStr
                            )
                        )
                    } finally { pendingResult.finish() }
                }
            }
            launchFullScreenAlarm(context, subject, startHour, startMin)
        }
    }

    // ── Full-screen alarm (rings over lock screen) ────────────────────────────

    private fun launchFullScreenAlarm(context: Context, subject: String, startHour: Int, startMin: Int) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        nm.createNotificationChannel(
            NotificationChannel(
                ALARM_CHANNEL_ID,
                "Study Alarms",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                enableVibration(true)
                setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), null)
                setBypassDnd(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
        )

        // Full-screen intent — launches AlarmActivity over the lock screen
        val fullScreenIntent = Intent(context, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION
            putExtra("subject",    subject)
            putExtra("start_hour", startHour)
            putExtra("start_min",  startMin)
        }
        val fullScreenPi = PendingIntent.getActivity(
            context,
            subject.hashCode(),
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Tap-to-open intent (if user taps the notification instead)
        val tapIntent = PendingIntent.getActivity(
            context,
            subject.hashCode() + 99,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val startTime = "%02d:%02d".format(startHour, startMin)
        val notification = NotificationCompat.Builder(context, ALARM_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("📚 Time to Study — $subject")
            .setContentText("Your $subject session starts now ($startTime). Open TutorUG!")
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText("Your $subject session starts now ($startTime). Open TutorUG!"))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
            .setVibrate(longArrayOf(0, 600, 200, 600, 200, 600))
            .setAutoCancel(true)
            .setContentIntent(tapIntent)
            .setFullScreenIntent(fullScreenPi, true)   // ← this is what rings over lock screen
            .setOngoing(true)
            .build()

        nm.notify(subject.hashCode(), notification)
    }

    // ── 15-min reminder notification (silent heads-up) ────────────────────────

    private fun showReminderNotification(context: Context, subject: String, startTime: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        nm.createNotificationChannel(
            NotificationChannel(
                REMINDER_CHANNEL_ID,
                "Study Reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            )
        )

        val tapIntent = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, REMINDER_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("⏰ Study Reminder — 15 mins!")
            .setContentText("$subject starts at $startTime. Get ready!")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(tapIntent)
            .setAutoCancel(true)
            .build()

        nm.notify(subject.hashCode() + 1, notification)
    }

    companion object {
        const val ALARM_CHANNEL_ID    = "tutorug_alarm"
        const val REMINDER_CHANNEL_ID = "tutorug_reminder"
    }
}
