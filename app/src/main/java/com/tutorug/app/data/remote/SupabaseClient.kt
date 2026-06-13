package com.tutorug.app.data.remote

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit

object SupabaseClient {
    const val SUPABASE_URL = "https://jsjhgwficdrgzwbwzkhm.supabase.co"
    const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzamhnd2ZpY2RyZ3p3Ynd6a2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDUyNzQsImV4cCI6MjA5MDc4MTI3NH0.wlHsR1BNFBWV2UGQ1pnxlqoSdKhB6tYHVgwM2sLL5MU"

    private const val PREFS_NAME = "tutorug_auth"
    private const val KEY_ACCESS  = "access_token"
    private const val KEY_REFRESH = "refresh_token"
    private const val KEY_USER_ID = "user_id"

    private var prefs: android.content.SharedPreferences? = null

    fun init(context: android.content.Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
        // Restore persisted token into memory on app start
        authToken = prefs?.getString(KEY_ACCESS, null)
    }

    fun persistSession(accessToken: String, refreshToken: String, userId: String) {
        authToken = accessToken
        prefs?.edit()
            ?.putString(KEY_ACCESS, accessToken)
            ?.putString(KEY_REFRESH, refreshToken)
            ?.putString(KEY_USER_ID, userId)
            ?.apply()
    }

    fun getPersistedRefreshToken(): String? = prefs?.getString(KEY_REFRESH, null)
    fun getPersistedUserId(): String? = prefs?.getString(KEY_USER_ID, null)

    fun clearSession() {
        authToken = null
        prefs?.edit()?.clear()?.apply()
    }

    var authToken: String? = null

    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        })
        .addInterceptor { chain ->
            val request = chain.request()
            val isEdgeFunction = request.url.toString().contains("/functions/v1/")
            val token = if (isEdgeFunction) SUPABASE_ANON_KEY else (authToken ?: SUPABASE_ANON_KEY)
            if (!isEdgeFunction && authToken == null) {
                android.util.Log.w("TutorUG", "WARNING: REST call without user JWT — RLS may not be enforced: ${request.url}")
            }
            val newRequest = request.newBuilder()
                .header("apikey", SUPABASE_ANON_KEY)
                .header("Authorization", "Bearer $token")
                .header("Content-Type", "application/json")
                .build()
            chain.proceed(newRequest)
        }
        .build()
}
