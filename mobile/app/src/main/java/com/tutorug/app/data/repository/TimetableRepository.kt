package com.tutorug.app.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tutorug.app.data.model.TimetableEntry
import com.tutorug.app.data.remote.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.UUID

class TimetableRepository {

    private val base  = SupabaseClient.SUPABASE_URL
    private val http  = SupabaseClient.http
    private val gson  = Gson()
    private val json  = "application/json".toMediaType()

    suspend fun getEntries(userId: String): List<TimetableEntry> = withContext(Dispatchers.IO) {
        try {
            val resp = http.newCall(
                Request.Builder()
                    .url("$base/rest/v1/timetable_entries?user_id=eq.$userId&order=day_of_week.asc,start_hour.asc,start_min.asc")
                    .get().build()
            ).execute()
            val body = resp.body?.string() ?: return@withContext emptyList()
            gson.fromJson(body, object : TypeToken<List<TimetableEntry>>() {}.type) ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }

    suspend fun addEntry(entry: TimetableEntry): Result<TimetableEntry> = withContext(Dispatchers.IO) {
        try {
            val newEntry = entry.copy(entryId = UUID.randomUUID().toString())
            val payload  = gson.toJson(newEntry)
            val resp = http.newCall(
                Request.Builder()
                    .url("$base/rest/v1/timetable_entries")
                    .addHeader("Prefer", "return=representation")
                    .post(payload.toRequestBody(json))
                    .build()
            ).execute()
            val body = resp.body?.string() ?: ""
            if (!resp.isSuccessful) {
                return@withContext Result.failure(Exception("HTTP ${resp.code}: $body"))
            }
            val list: List<TimetableEntry> = gson.fromJson(body, object : TypeToken<List<TimetableEntry>>() {}.type)
            val saved = list.firstOrNull()
                ?: return@withContext Result.failure(Exception("Empty response from server"))
            Result.success(saved)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateEntry(entry: TimetableEntry): Boolean = withContext(Dispatchers.IO) {
        try {
            val payload = gson.toJson(mapOf(
                "subject"    to entry.subject,
                "day_of_week" to entry.dayOfWeek,
                "start_hour" to entry.startHour,
                "start_min"  to entry.startMin,
                "end_hour"   to entry.endHour,
                "end_min"    to entry.endMin,
                "color_hex"  to entry.colorHex
            ))
            val resp = http.newCall(
                Request.Builder()
                    .url("$base/rest/v1/timetable_entries?entry_id=eq.${entry.entryId}")
                    .addHeader("Prefer", "return=minimal")
                    .patch(payload.toRequestBody(json))
                    .build()
            ).execute()
            resp.isSuccessful
        } catch (_: Exception) { false }
    }

    suspend fun deleteEntry(entryId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val resp = http.newCall(
                Request.Builder()
                    .url("$base/rest/v1/timetable_entries?entry_id=eq.$entryId")
                    .delete()
                    .build()
            ).execute()
            resp.isSuccessful
        } catch (_: Exception) { false }
    }

}
