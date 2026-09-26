package com.tutorug.app.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tutorug.app.data.model.Review
import com.tutorug.app.data.remote.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class FeedbackRepository {

    private val gson = Gson()
    private val base = SupabaseClient.SUPABASE_URL
    private val http = SupabaseClient.http

    /**
     * Columns the running database is known to have. The richer triage columns
     * (category, app_version, screen) only exist once feedback_migration.sql has
     * been applied, and a student should never lose a bug report just because a
     * migration has not been run yet. PostgREST rejects the whole insert when it
     * sees an unknown column, so on that specific error we drop the offending
     * column and remember the working set for later submissions.
     */
    private val knownColumns = mutableSetOf(
        "user_id", "title", "comment", "rating", "status", "app_version", "screen"
    )

    /** Why a submission did not reach the database, phrased for the student. */
    sealed class SubmitResult {
        data object Success : SubmitResult()
        data class Failed(val message: String) : SubmitResult()
    }

    /**
     * Stores one feedback entry. `rating` is nullable by design — the column was
     * NOT NULL before, which meant a student whose login was crashing had to
     * pick a star rating or the report was lost.
     *
     * `user_id` must be the caller's auth uid: the reviews_insert_own RLS policy
     * enforces `auth.uid()::text = user_id`, so a mismatch fails the insert
     * rather than writing someone else's name.
     */
    suspend fun submitReview(
        userId: String,
        title: String,
        comment: String,
        rating: Int?,
        appVersion: String,
        screen: String
    ): SubmitResult = withContext(Dispatchers.IO) {
        val allFields = JSONObject().apply {
            put("user_id", userId)
            put("title", title.take(120))
            put("comment", comment.take(4000))
            // A null rating is sent as SQL NULL, which the column only accepts
            // after the migration drops its NOT NULL constraint.
            put("rating", rating ?: JSONObject.NULL)
            put("app_version", appVersion.take(40))
            put("screen", screen.take(60))
            // Triage fields are deliberately absent: the student does not choose
            // a category, and 'pending' + null category is what the dashboard
            // filters on to find untriaged work.
            put("status", "pending")
        }

        // Bounded retry: each pass can drop every column PostgREST complained about,
        // so a few passes is plenty and a real failure still cannot loop.
        repeat(4) {
            val row = JSONObject().apply {
                allFields.keys().forEach { column ->
                    if (knownColumns.contains(column)) put(column, allFields.get(column))
                }
            }

            val (code, errorText) = post(row)

            if (code in 200..299) return@withContext SubmitResult.Success

            val missing = findMissingColumns(errorText)
            val removed = missing.filter { knownColumns.remove(it) }
            if (removed.isNotEmpty()) {
                android.util.Log.w("TutorUG_Feedback", "columns absent, retrying without: $removed")
                return@repeat
            }
            android.util.Log.e("TutorUG_Feedback", "submit failed: $code ${errorText.take(300)}")
            return@withContext SubmitResult.Failed(friendlyMessage(code, errorText))
        }

        SubmitResult.Failed("We could not send your feedback. Please try again.")
    }

    /** POSTs one row and returns the status code with the response body for diagnosis. */
    private fun post(row: JSONObject): Pair<Int, String> {
        val request = Request.Builder()
            .url("$base/rest/v1/reviews")
            .post(row.toString().toRequestBody("application/json".toMediaType()))
            .build()
        http.newCall(request).execute().use { response ->
            return response.code to (response.body?.string() ?: "")
        }
    }

    /** Pulls every absent column name out of a PostgREST unknown-column error. */
    private fun findMissingColumns(errorText: String): List<String> =
        UNKNOWN_COLUMN.findAll(errorText)
            .map { it.groupValues[1].ifEmpty { it.groupValues[2] } }
            .distinct()
            .toList()

    /**
     * Never tells a student to retry something that cannot succeed. A schema
     * problem or a rejected identity needs a developer, not another tap.
     */
    private fun friendlyMessage(code: Int, errorText: String): String = when {
        code == 401 || code == 403 ->
            "Please sign in again, then resend your feedback."
        code == 409 || errorText.contains("duplicate key", ignoreCase = true) ->
            "You already sent this feedback."
        errorText.contains("rating", ignoreCase = true) &&
            errorText.contains("null", ignoreCase = true) ->
            "Your feedback needs a star rating on this version of the app."
        else -> "We could not send your feedback. Please try again."
    }

    /** The student's own submissions, newest first, for the "you sent this" list. */
    suspend fun loadMyReviews(userId: String): List<Review> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$base/rest/v1/reviews?user_id=eq.$userId&order=created_at.desc&limit=20")
                .get().build()
            val body = http.newCall(request).execute().body?.string() ?: return@withContext emptyList()
            gson.fromJson(body, object : TypeToken<List<Review>>() {}.type) ?: emptyList()
        } catch (e: Exception) {
            android.util.Log.e("TutorUG_Feedback", "loadMyReviews error: ${e.message}")
            emptyList()
        }
    }

    private companion object {
        // PostgREST reports an unknown column as PGRST204, quoting the bare name:
        //   Could not find the 'app_version' column of 'reviews' in the schema cache
        // The second pattern is Postgres' own wording, kept as a fallback.
        val UNKNOWN_COLUMN = Regex(
            "Could not find the '([A-Za-z0-9_]+)' column of|column reviews\\.([A-Za-z0-9_]+) does not exist"
        )
    }
}
