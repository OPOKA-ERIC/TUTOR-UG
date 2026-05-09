package com.tutorug.app.util

import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit

class AnthropicClient(private val apiKey: String) {
    private val client = OkHttpClient.Builder()
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        })
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val mediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun sendMessage(
        systemPrompt: String,
        messages: List<Map<String, String>>
    ): String = withContext(Dispatchers.IO) {
        val json = JsonObject().apply {
            addProperty("model", "claude-3-5-sonnet-20240620")
            addProperty("max_tokens", 2048)
            addProperty("system", systemPrompt)
            val messagesArray = JsonArray()
            messages.forEach { msg ->
                val msgObj = JsonObject()
                msgObj.addProperty("role", msg["role"])
                msgObj.addProperty("content", msg["content"])
                messagesArray.add(msgObj)
            }
            add("messages", messagesArray)
        }

        val request = Request.Builder()
            .url("https://api.anthropic.com/v1/messages")
            .addHeader("x-api-key", apiKey)
            .addHeader("anthropic-version", "2023-06-01")
            .post(gson.toJson(json).toRequestBody(mediaType))
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw Exception("API Error: ${response.code}")
            val body = response.body?.string() ?: throw Exception("Empty response")
            val jsonResponse = gson.fromJson(body, JsonObject::class.java)
            jsonResponse.getAsJsonArray("content")
                .get(0).asJsonObject
                .get("text").asString
        }
    }
}
