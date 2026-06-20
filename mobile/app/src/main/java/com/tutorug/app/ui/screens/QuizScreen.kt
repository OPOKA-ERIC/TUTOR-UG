package com.tutorug.app.ui.screens

import android.media.AudioManager
import android.media.ToneGenerator
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tutorug.app.data.model.QuizQuestion
import com.tutorug.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuizScreen(
    sectionTitle: String = "",
    currentSection: Int = 1,
    totalSections: Int = 5,
    questions: List<QuizQuestion> = emptyList(),
    isLoading: Boolean = false,
    onAnswerSubmit: (Int, Int) -> Unit = { _, _ -> },
    onNextSection: () -> Unit = {},
    onRetryQuiz: () -> Unit = {},
    onReExplain: () -> Unit = {},
    onFinishQuiz: () -> Unit = {},
    onBackClick: () -> Unit = {},
    showResults: Boolean = false,
    score: Int = 0,
    quizSoundEnabled: Boolean = true,
    quizResults: List<com.tutorug.app.data.model.QuizResult> = emptyList()
) {
    var currentQuestionIndex by remember { mutableStateOf(0) }
    var selectedAnswer by remember { mutableStateOf<Int?>(null) }
    var answeredQuestions by remember { mutableStateOf(setOf<Int>()) }

    // Reset local state whenever a fresh set of questions arrives
    LaunchedEffect(questions) {
        currentQuestionIndex = 0
        selectedAnswer = null
        answeredQuestions = emptySet()
    }

    fun playSound(correct: Boolean) {
        if (!quizSoundEnabled) return
        try {
            val tg = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
            if (correct) {
                // Two short rising beeps — pleasant success
                tg.startTone(ToneGenerator.TONE_PROP_ACK, 120)
            } else {
                // Single short low blip — brief and instant, not alarming
                tg.startTone(ToneGenerator.TONE_PROP_NACK, 80)
            }
            // ToneGenerator releases itself after the duration
        } catch (_: Exception) {}
    }

    val currentQuestion = if (questions.isNotEmpty() && currentQuestionIndex < questions.size)
        questions[currentQuestionIndex] else null

    val passed = score >= 70

    val bg           = AppColors.background
    val surface      = AppColors.surface
    val surfaceVar   = AppColors.surfaceVar
    val primary      = AppColors.primary
    val onPrimary    = AppColors.onPrimary
    val secondary    = AppColors.secondary
    val tertiary     = AppColors.tertiary
    val outline      = AppColors.outline
    val surfaceInput = AppColors.surfaceInput
    val onSurfaceVar = AppColors.onSurfaceVar
    val barStart     = AppColors.barStart
    val barEnd       = AppColors.barEnd
    val error        = AppColors.error

    Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(surface, bg)))) {
        Box(
            modifier = Modifier.size(220.dp).offset(x = (-60).dp, y = 200.dp)
                .background(Brush.radialGradient(listOf(tertiary.copy(alpha = 0.1f), Color.Transparent)), CircleShape)
        )

        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {

            // ── TOP BAR ──────────────────────────────────────────────
            Box(
                modifier = Modifier.fillMaxWidth()
                    .background(Brush.horizontalGradient(listOf(barStart, barEnd)))
                    .padding(horizontal = 8.dp, vertical = 8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .noRippleClickable { onBackClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Box(modifier = Modifier.size(36.dp).background(surfaceInput, CircleShape),
                            contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.ArrowBack, null, tint = TextWhite, modifier = Modifier.size(18.dp))
                        }
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                    AppLogo()
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(if (sectionTitle.isNotBlank()) "Quiz: $sectionTitle" else "Quiz",
                            fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                        if (!showResults && questions.isNotEmpty())
                            Text("Q ${currentQuestionIndex + 1} / ${questions.size}", fontSize = 11.sp, color = onSurfaceVar)
                    }
                }
            }

            // Section progress dots
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                repeat(totalSections) { index ->
                    val done = index < currentSection
                    Box(modifier = Modifier.size(if (done) 14.dp else 10.dp)
                        .background(if (done) Lime400 else outline, CircleShape))
                    if (index < totalSections - 1) Spacer(modifier = Modifier.width(8.dp))
                }
            }

            // ── LOADING ──────────────────────────────────────────────
            if (isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize().navigationBarsPadding(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = primary, strokeWidth = 3.dp)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Generating quiz questions...", color = onSurfaceVar, fontSize = 14.sp)
                    }
                }

            // ── RESULTS ──────────────────────────────────────────────
            } else if (showResults) {
                Column(
                    modifier = Modifier.fillMaxSize().navigationBarsPadding()
                        .verticalScroll(rememberScrollState()).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier.size(140.dp).background(
                            Brush.radialGradient(listOf(
                                if (passed) Lime400.copy(alpha = 0.2f) else error.copy(alpha = 0.2f),
                                Color.Transparent
                            )), CircleShape
                        ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            if (passed) Icons.Default.EmojiEvents else Icons.Default.Refresh,
                            null, tint = if (passed) Lime400 else error,
                            modifier = Modifier.size(72.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(24.dp))
                    Text(
                        if (passed) "Great Work! 🎉" else "Keep Going! 💪",
                        fontSize = 28.sp, fontWeight = FontWeight.Bold,
                        color = if (passed) Lime400 else error
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("$score%", fontSize = 56.sp, fontWeight = FontWeight.Black, color = primary)
                    Spacer(modifier = Modifier.height(12.dp))

                    // Score reason card
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        color = if (passed) Lime400.copy(alpha = 0.08f) else error.copy(alpha = 0.08f)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(
                                if (passed) "You scored $score% — you have a solid understanding of this section."
                                else "You scored $score% — you need 70% or above to move on.",
                                fontSize = 13.sp,
                                color = if (passed) Lime400 else error,
                                textAlign = TextAlign.Center
                            )
                            if (passed) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    "You can continue to the next section or strengthen your understanding further.",
                                    fontSize = 12.sp, color = onSurfaceVar, textAlign = TextAlign.Center
                                )
                            } else {
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    "Try redoing the quiz with new questions or ask the AI to re-explain the section differently.",
                                    fontSize = 12.sp, color = onSurfaceVar, textAlign = TextAlign.Center
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(28.dp))

                    if (passed) {
                        // ── PASS: Continue first, then Redo + Re-explain ──
                        GradientButton(
                            text = "Continue to Next Section →",
                            colors = listOf(Lime400, Lime600),
                            textColor = Ink900,
                            onClick = onNextSection
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        GradientButton(
                            text = "Redo Quiz",
                            colors = listOf(tertiary, Violet600),
                            textColor = TextWhite,
                            onClick = onRetryQuiz
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        GradientButton(
                            text = "Re-explain This Section",
                            colors = listOf(surfaceVar, surfaceVar),
                            textColor = onSurfaceVar,
                            onClick = onReExplain
                        )
                    } else {
                        // ── FAIL: Redo Quiz + Re-explain ──────────────────
                        GradientButton(
                            text = "Redo Quiz",
                            colors = listOf(Amber400, Amber600),
                            textColor = onPrimary,
                            onClick = onRetryQuiz
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        GradientButton(
                            text = "Re-explain This Section",
                            colors = listOf(tertiary, Violet600),
                            textColor = TextWhite,
                            onClick = onReExplain
                        )
                    }

                    // ── QUIZ HISTORY ──────────────────────────────────
                    if (quizResults.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(28.dp))
                        Text("RECENT RESULTS", fontSize = 11.sp, fontWeight = FontWeight.Bold,
                            color = onSurfaceVar, modifier = Modifier.fillMaxWidth())
                        Spacer(modifier = Modifier.height(10.dp))
                        quizResults.take(5).forEach { result ->
                            Surface(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                color = surfaceVar, shape = RoundedCornerShape(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            result.sectionTitle.ifBlank { result.subject.ifBlank { "Quiz" } },
                                            fontSize = 13.sp, color = TextWhite,
                                            fontWeight = FontWeight.Medium,
                                            maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                        )
                                        Text(
                                            "${result.correctAnswers}/${result.totalQuestions} correct  •  ${result.difficulty}",
                                            fontSize = 11.sp, color = onSurfaceVar
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Text(
                                        "${result.score}%",
                                        fontSize = 16.sp, fontWeight = FontWeight.Bold,
                                        color = if (result.passed) Lime400 else error
                                    )
                                }
                            }
                        }
                    }
                }

            // ── QUESTION ─────────────────────────────────────────────
            } else if (currentQuestion != null) {
                Column(
                    modifier = Modifier.fillMaxSize().navigationBarsPadding()
                        .verticalScroll(rememberScrollState()).padding(24.dp)
                ) {
                    Surface(modifier = Modifier.fillMaxWidth(), color = surface, shape = RoundedCornerShape(16.dp)) {
                        Column(modifier = Modifier.padding(20.dp)) {
                            Text("Question ${currentQuestionIndex + 1}", fontSize = 12.sp,
                                color = primary, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(currentQuestion.question, fontSize = 17.sp, color = TextWhite, fontWeight = FontWeight.Medium)
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    val isAnswered = answeredQuestions.contains(currentQuestionIndex)

                    currentQuestion.options.forEachIndexed { index, option ->
                        val isSelected = selectedAnswer == index
                        val isCorrect  = index == currentQuestion.correctIndex

                        val bgColor = when {
                            isAnswered && isCorrect                  -> Lime400.copy(alpha = 0.15f)
                            isAnswered && isSelected && !isCorrect  -> error.copy(alpha = 0.15f)
                            isSelected                               -> primary.copy(alpha = 0.1f)
                            else                                     -> surfaceVar
                        }
                        val borderColor = when {
                            isAnswered && isCorrect                  -> Lime400
                            isAnswered && isSelected && !isCorrect  -> error
                            isSelected                               -> primary
                            else                                     -> outline
                        }

                        Surface(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp)
                                .clickable(enabled = !isAnswered) { selectedAnswer = index },
                            color = bgColor, shape = RoundedCornerShape(12.dp),
                            border = ButtonDefaults.outlinedButtonBorder.copy(brush = SolidColor(borderColor), width = 1.5.dp)
                        ) {
                            Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier.size(28.dp).background(borderColor.copy(alpha = 0.2f), CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("${'A' + index}", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = borderColor)
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(option, fontSize = 15.sp, color = TextWhite, modifier = Modifier.weight(1f))
                                if (isAnswered && isCorrect)
                                    Icon(Icons.Default.CheckCircle, null, tint = Lime400, modifier = Modifier.size(20.dp))
                            }
                        }
                    }

                    if (selectedAnswer != null && !answeredQuestions.contains(currentQuestionIndex)) {
                        Spacer(modifier = Modifier.height(20.dp))
                        GradientButton(
                            text = "Submit Answer",
                            colors = listOf(Amber400, Amber600),
                            textColor = onPrimary,
                            onClick = {
                                val isCorrect = selectedAnswer == currentQuestion.correctIndex
                                playSound(isCorrect)
                                onAnswerSubmit(currentQuestionIndex, selectedAnswer!!)
                                answeredQuestions = answeredQuestions + currentQuestionIndex
                            }
                        )
                    }

                    if (answeredQuestions.contains(currentQuestionIndex)) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Surface(modifier = Modifier.fillMaxWidth(), color = secondary.copy(alpha = 0.08f), shape = RoundedCornerShape(12.dp)) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text("Explanation", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = secondary)
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(currentQuestion.explanation, fontSize = 14.sp, color = TextLight)
                            }
                        }
                        Spacer(modifier = Modifier.height(20.dp))
                        if (currentQuestionIndex < questions.size - 1) {
                            GradientButton("Next Question \u2192", listOf(tertiary, Violet600), TextWhite) {
                                currentQuestionIndex++; selectedAnswer = null
                            }
                        } else {
                            GradientButton("Finish Quiz \uD83C\uDF89", listOf(Lime400, Lime600), Ink900, onFinishQuiz)
                        }
                    }
                    Spacer(modifier = Modifier.height(32.dp))
                }
            }
        }
    }
}

@Composable
private fun GradientButton(text: String, colors: List<Color>, textColor: Color, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
        contentPadding = PaddingValues(0.dp)
    ) {
        Box(
            modifier = Modifier.fillMaxSize()
                .background(Brush.linearGradient(colors), RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center
        ) { Text(text, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = textColor) }
    }
}
