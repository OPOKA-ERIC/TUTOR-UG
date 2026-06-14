package com.tutorug.app.util

import android.content.Context
import android.content.Intent
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import androidx.activity.result.ActivityResultLauncher
import java.util.*

class VoiceManager(private val context: Context) {

    private var tts: TextToSpeech? = null
    private var isTTSReady = false
    private var currentRate: Float = 1.0f
    private var currentGenderMale: Boolean = false

    // Exposed so UI can show pause/stop buttons
    var isSpeaking: Boolean = false
        private set
    var isPaused: Boolean = false
        private set

    fun initializeTTS(onReady: () -> Unit = {}) {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.UK
                isTTSReady = true
                applyRate(currentRate)
                applyGender(currentGenderMale)
                onReady()
            }
        }
    }

    fun setSpeechRate(rate: Float) {
        currentRate = rate
        applyRate(rate)
    }

    fun setVoiceMale(male: Boolean) {
        currentGenderMale = male
        applyGender(male)
        applyRate(currentRate) // re-apply rate since some engines reset it after voice change
    }

    private fun applyRate(rate: Float) {
        tts?.setSpeechRate(rate)
    }

    private fun applyGender(male: Boolean) {
        if (!isTTSReady) return
        val engine = tts ?: return
        val voices = engine.voices

        // Strategy 1: find a voice whose name contains a gender keyword
        val genderKeywords = if (male)
            listOf("male", "-m-", "-m1", "-m2", "-m3", "_male", "#male")
        else
            listOf("female", "-f-", "-f1", "-f2", "-f3", "_female", "#female")

        val namedMatch = voices?.firstOrNull { v ->
            v.locale.language == "en" &&
            !v.isNetworkConnectionRequired &&
            genderKeywords.any { kw -> v.name.contains(kw, ignoreCase = true) }
        }

        if (namedMatch != null) {
            engine.voice = namedMatch
            // Still apply pitch on top for extra clarity
            engine.setPitch(if (male) 0.7f else 1.1f)
            return
        }

        // Strategy 2: reset to default voice then use pitch alone
        // Male: very low pitch (0.5) sounds clearly male on all devices
        // Female: slightly raised pitch (1.15) sounds clearly female
        val defaultVoice = voices?.firstOrNull { v ->
            v.locale.language == "en" && !v.isNetworkConnectionRequired
        }
        if (defaultVoice != null) engine.voice = defaultVoice
        engine.setPitch(if (male) 0.5f else 1.15f)
    }

    fun speak(text: String) {
        if (!isTTSReady) return
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "tutorug_utterance")
        isSpeaking = true
        isPaused = false
    }

    fun pauseSpeaking() {
        if (!isSpeaking || isPaused) return
        tts?.stop()          // Android TTS has no real pause — stop and mark paused
        isPaused = true
        isSpeaking = false
    }

    fun stopSpeaking() {
        tts?.stop()
        isSpeaking = false
        isPaused = false
    }

    /** Increase speed by 0.25x step, capped at 2.0 */
    fun speedUp() { setSpeechRate((currentRate + 0.25f).coerceAtMost(2.0f)) }

    /** Decrease speed by 0.25x step, minimum 0.5 */
    fun slowDown() { setSpeechRate((currentRate - 0.25f).coerceAtLeast(0.5f)) }

    fun getCurrentRate(): Float = currentRate

    fun shutdown() {
        tts?.shutdown()
    }

    fun startSpeechRecognition(launcher: ActivityResultLauncher<Intent>) {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.UK)
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak your question...")
        }
        launcher.launch(intent)
    }
}
