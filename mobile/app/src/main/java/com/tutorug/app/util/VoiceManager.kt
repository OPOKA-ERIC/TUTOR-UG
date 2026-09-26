package com.tutorug.app.util

import android.content.Context
import android.content.Intent
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import android.speech.tts.UtteranceProgressListener
import androidx.activity.result.ActivityResultLauncher
import java.util.Locale

/** Which seat is speaking. Drives voice selection so the two hosts never sound alike. */
enum class VoiceRole { HOST, STUDENT, NEUTRAL }

class VoiceManager(private val context: Context) {

    private var tts: TextToSpeech? = null
    private var isTTSReady = false
    private var currentRate: Float = 1.0f
    private var currentGenderMale: Boolean = false

    /**
     * Gender of the learner in the podcast's STUDENT turn. Separate from
     * [currentGenderMale], which is the learner's choice for the chatbot voice.
     */
    private var studentIsMale: Boolean = false

    // Cached per-role voice so we do not rescan the engine on every segment.
    private var hostVoice: Voice? = null
    private var studentVoice: Voice? = null
    private var roleResolved = false
    // True when the engine could only give us one voice, so pitch has to carry
    // the gender difference on its own.
    private var voiceCollision = false

    // One listener for the whole engine. Re-registering per utterance used to
    // clobber the in-flight callback and break chained playback.
    private var activeOnDone: (() -> Unit)? = null
    private var utteranceSeq = 0L

    // Held so a second caller arriving mid-initialisation still gets its callback.
    private var ttsReadyHook: (() -> Unit)? = null

    var isSpeaking: Boolean = false
        private set
    var isPaused: Boolean = false
        private set

    /** True when the engine has at least one usable English voice we can pitch. */
    val hasEnglishVoice: Boolean get() = isTTSReady

    private var initInFlight = false

    /**
     * Idempotent. This VoiceManager instance is shared with ChatViewModel, and
     * PodcastScreen may open while chat has already initialised it. Creating a
     * second TextToSpeech engine would leak the first and could interleave
     * utterances, so re-entry is a no-op.
     */
    fun initializeTTS(onReady: () -> Unit = {}) {
        if (isTTSReady) {
            onReady()
            return
        }
        if (initInFlight) {
            ttsReadyHook = onReady
            return
        }
        initInFlight = true
        ttsReadyHook = onReady
        tts = TextToSpeech(context) { status ->
            initInFlight = false
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.UK
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        isSpeaking = true
                        isPaused = false
                    }

                    override fun onDone(utteranceId: String?) {
                        isSpeaking = false
                        val cb = activeOnDone
                        activeOnDone = null
                        cb?.invoke()
                    }

                    override fun onError(utteranceId: String?) {
                        isSpeaking = false
                        // Advance anyway, otherwise a single failed segment
                        // stalls the rest of the episode forever.
                        val cb = activeOnDone
                        activeOnDone = null
                        cb?.invoke()
                    }

                    @Deprecated("Required by the base class", ReplaceWith(""))
                    override fun onError(utteranceId: String?, errorCode: Int) {
                        onError(utteranceId)
                    }
                })
                isTTSReady = true
                applyRate(currentRate)
                applyGender(currentGenderMale)
                resolveRoleVoices()
                // Engines frequently publish their voice list a moment after
                // init, so re-check once the list has had time to arrive.
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    if (isTTSReady) {
                        roleResolved = false
                        resolveRoleVoices()
                    }
                }, 1200)
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
        applyRate(currentRate) // some engines reset rate after a voice change
        // The HOST podcast voice follows this setting, so re-resolve the pair.
        roleResolved = false
        resolveRoleVoices()
    }

    /**
     * Sets the gender used for the podcast's STUDENT turn. Independent of
     * [setVoiceMale], which governs the chatbot. Unknown/other is treated as
     * female, which matches the app's existing default voice.
     */
    fun setStudentIsMale(male: Boolean) {
        if (studentIsMale == male) return
        studentIsMale = male
        roleResolved = false
        resolveRoleVoices()
    }

    private fun applyRate(rate: Float) {
        tts?.setSpeechRate(rate)
    }

    private fun allEnglishVoices(): List<Voice> =
        tts?.voices?.filter { it.locale.language == "en" } ?: emptyList()

    private fun englishVoices(): List<Voice> {
        val en = allEnglishVoices()
        // Prefer offline voices: a podcast that stalls on a dead network is
        // useless to a student in a district with patchy data.
        val offline = en.filter { !it.isNetworkConnectionRequired }
        return offline.ifEmpty { en }
    }

    /**
     * Finds a voice whose name declares the requested gender. Searching only the
     * offline pool meant a device whose only male voice needed network could never
     * find one, so both roles silently shared a single voice.
     */
    private fun voiceForGender(male: Boolean): Voice? {
        val all = allEnglishVoices()
        if (all.isEmpty()) return null
        val offline = all.filter { !it.isNetworkConnectionRequired }
        return all.firstOrNull { genderMatches(it, male) && !it.isNetworkConnectionRequired }
            ?: all.firstOrNull { genderMatches(it, male) }
            ?: offline.firstOrNull()
            ?: all.first()
    }

    /**
     * "female" contains the substring "male", so the old list-based `contains`
     * check rated a female voice as the strongest male match. A boy was then
     * narrated by a girl, the resolver believed the two roles had distinct
     * voices, and the corrective pitch was skipped. The bare "male"/"female"
     * keywords are therefore matched as whole tokens, and a voice that declares
     * the opposite gender is rejected outright.
     */
    private fun genderMatches(v: Voice, male: Boolean): Boolean {
        val declaresMale = MALE_TOKEN.containsMatchIn(v.name)
        val declaresFemale = FEMALE_TOKEN.containsMatchIn(v.name)
        if (male) {
            if (declaresFemale) return false
            if (declaresMale) return true
            return maleKeywords.any { kw -> v.name.contains(kw, ignoreCase = true) }
        }
        if (declaresMale) return false
        if (declaresFemale) return true
        return femaleKeywords.any { kw -> v.name.contains(kw, ignoreCase = true) }
    }

    private val MALE_TOKEN = Regex("(^|[^a-z])male($|[^a-z])", RegexOption.IGNORE_CASE)
    private val FEMALE_TOKEN = Regex("(^|[^a-z])female($|[^a-z])", RegexOption.IGNORE_CASE)

    // The bare "male"/"female" words are handled by the token regexes above and
    // are deliberately absent from these lists so they cannot substring-match.
    private val maleKeywords = listOf("#male", "-m-", "-m1", "-m2", "_male")
    private val femaleKeywords = listOf("#female", "-f-", "-f1", "-f2", "_female")

    /**
     * Resolves the two podcast voices. Neither is hardcoded: the HOST follows the
     * Voice Gender the student chose in Settings, and the STUDENT follows the
     * learner's own gender so a boy is not read by a girl.
     *
     * Critically, this does NOT latch when the engine has not published its voice
     * list yet. tts.voices is commonly empty for a moment after init, and caching
     * that empty result is what made the gender setting appear to do nothing.
     */
    private fun resolveRoleVoices() {
        if (roleResolved) return
        val all = allEnglishVoices()
        if (all.isEmpty()) {
            roleResolved = false
            return
        }

        val host = voiceForGender(currentGenderMale)
        val studentWanted = voiceForGender(studentIsMale)
        hostVoice = host

        // A collision means the student's voice is the WRONG GENDER, not merely
        // the same object as the host. voiceForGender always borrows some English
        // voice when no gender match exists, so comparing object identity
        // reported "no collision" whenever the device lacked a male voice, which
        // skipped the corrective pitch and left a boy sounding like a girl.
        val collided = studentWanted == null || !genderMatches(studentWanted, studentIsMale)
        studentVoice = when {
            !collided -> studentWanted
            // Same-gender pairing: borrow any other English voice for contrast.
            else -> all.firstOrNull { it !== host } ?: host
        }
        voiceCollision = collided
        roleResolved = true

        // Visible in logcat so a wrong-sounding voice can be diagnosed without
        // guessing: filter on "TutorUGTTS".
        android.util.Log.d(
            "TutorUGTTS",
            "roles resolved: hostMale=$currentGenderMale studentMale=$studentIsMale " +
                "collision=$collided host=${host?.name} student=${studentVoice?.name} " +
                "englishVoices=${all.size}"
        )
    }

    /**
     * Pitch is the fallback differentiator when the engine cannot give us two
     * distinct voices. A male student sharing the host's voice must be shifted
     * down, otherwise raising the pitch makes a boy sound even more feminine.
     */
    private fun pitchFor(role: VoiceRole): Float = when (role) {
        VoiceRole.HOST -> if (currentGenderMale) 0.85f else 1.05f
        VoiceRole.STUDENT -> when {
            !voiceCollision -> 1.0f
            studentIsMale -> 0.72f
            else -> 1.28f
        }
        VoiceRole.NEUTRAL -> if (currentGenderMale) 0.7f else 1.1f
    }

    private fun applyRole(role: VoiceRole) {
        if (!isTTSReady) return
        val engine = tts ?: return
        // Voices often appear after init, so re-resolve lazily on every turn
        // rather than trusting a cache built when the list was still empty.
        if (!roleResolved) resolveRoleVoices()
        when (role) {
            VoiceRole.HOST -> {
                hostVoice?.let { engine.voice = it }
                engine.setPitch(pitchFor(VoiceRole.HOST))
            }
            VoiceRole.STUDENT -> {
                studentVoice?.let { engine.voice = it }
                engine.setPitch(pitchFor(VoiceRole.STUDENT))
            }
            VoiceRole.NEUTRAL -> applyGender(currentGenderMale)
        }
        applyRate(currentRate)
    }

    /** Chat keeps its user-selected voice. */
    private fun applyGender(male: Boolean) {
        if (!isTTSReady) return
        val engine = tts ?: return
        // Shares the resolver with the podcast so the chat voice can also reach a
        // gender-matching network voice when no offline one exists.
        val picked = voiceForGender(male)
        val isRealMatch = picked != null && allEnglishVoices().any { v ->
            v === picked && genderMatches(v, male)
        }
        picked?.let { engine.voice = it }
        engine.setPitch(
            when {
                isRealMatch -> if (male) 0.95f else 1.05f
                male -> 0.65f
                else -> 1.2f
            }
        )
    }

    /** Chat narration. Single voice, no callback. */
    fun speak(text: String) {
        if (!isTTSReady) return
        applyRole(VoiceRole.NEUTRAL)
        activeOnDone = null
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, nextId("chat"))
        isSpeaking = true
        isPaused = false
    }

    /**
     * Podcast narration. Selects a distinct voice per [role] and invokes
     * [onDone] when the segment finishes so the caller can advance the queue.
     */
    fun speakAs(text: String, role: VoiceRole, onDone: () -> Unit) {
        if (!isTTSReady || text.isBlank()) {
            onDone()
            return
        }
        applyRole(role)
        activeOnDone = onDone
        val id = nextId("pod")
        val params = android.os.Bundle()
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, params, id)
        isSpeaking = true
        isPaused = false
    }

    /** Kept for call sites that predate [speakAs]. */
    fun speak(text: String, onDone: () -> Unit) = speakAs(text, VoiceRole.NEUTRAL, onDone)

    private fun nextId(prefix: String): String = "$prefix-${utteranceSeq++}"

    /**
     * Android TTS cannot truly pause, so we stop and let the caller decide where
     * to resume. Callers track the exact utterance and replay from there.
     *
     * The pending callback is cleared *before* stop() because several engines
     * deliver onDone/onError as a side effect of stop(). Leaving it armed used
     * to advance the queue while paused, so pressing play resumed somewhere
     * completely different.
     */
    fun pauseSpeaking() {
        if (!isSpeaking) return
        activeOnDone = null
        tts?.stop()
        isPaused = true
        isSpeaking = false
    }

    fun stopSpeaking() {
        activeOnDone = null
        tts?.stop()
        isSpeaking = false
        isPaused = false
    }

    fun speedUp() { setSpeechRate((currentRate + 0.25f).coerceAtMost(2.0f)) }
    fun slowDown() { setSpeechRate((currentRate - 0.25f).coerceAtLeast(0.5f)) }

    fun getCurrentRate(): Float = currentRate

    fun shutdown() {
        activeOnDone = null
        tts?.shutdown()
        tts = null
        isTTSReady = false
        roleResolved = false
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
