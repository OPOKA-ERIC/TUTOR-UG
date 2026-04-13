package com.tutorug.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tutorug.app.data.model.QuizResult
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.theme.*

@Composable
fun LearningProgressScreen(
    userProfile: UserProfile,
    quizResults: List<QuizResult>,
    isLoading: Boolean,
    onBackClick: () -> Unit
) {
    val bg       = AppColors.background
    val surface  = AppColors.surface
    val primary  = AppColors.primary
    val barStart = AppColors.barStart
    val barEnd   = AppColors.barEnd
    val onSurfaceVar = AppColors.onSurfaceVar

    val totalQuizzes  = quizResults.size
    val passed        = quizResults.count { it.passed }
    val failed        = totalQuizzes - passed
    val avgScore      = if (totalQuizzes > 0) quizResults.map { it.score }.average().toInt() else 0
    val bestScore     = quizResults.maxOfOrNull { it.score } ?: 0
    val passRate      = if (totalQuizzes > 0) (passed * 100) / totalQuizzes else 0

    // Group by subject for breakdown
    val bySubject = quizResults.groupBy { it.subject.ifBlank { "General" } }

    Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(surface, bg)))) {
        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {

            // ── TOP BAR ──────────────────────────────────────────────
            Box(
                modifier = Modifier.fillMaxWidth()
                    .background(Brush.horizontalGradient(listOf(barStart, barEnd)))
                    .padding(horizontal = 8.dp, vertical = 8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier.size(48.dp).noRippleClickable { onBackClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Box(modifier = Modifier.size(36.dp).background(AppColors.surfaceInput, CircleShape),
                            contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.ArrowBack, null, tint = TextWhite, modifier = Modifier.size(18.dp))
                        }
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                    AppLogo()
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("Learning Progress", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                        Text(userProfile.name.ifBlank { "Student" }, fontSize = 11.sp, color = onSurfaceVar)
                    }
                }
            }

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = primary)
                }
                return@Column
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize().navigationBarsPadding(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // ── OVERVIEW STATS ────────────────────────────────────
                item {
                    Text("OVERVIEW", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = onSurfaceVar)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatCard(Modifier.weight(1f), "Total Quizzes", totalQuizzes.toString(), Icons.Default.Quiz, Amber500)
                        StatCard(Modifier.weight(1f), "Passed", passed.toString(), Icons.Default.CheckCircle, Lime400)
                        StatCard(Modifier.weight(1f), "Failed", failed.toString(), Icons.Default.Cancel, Coral500)
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatCard(Modifier.weight(1f), "Avg Score", "$avgScore%", Icons.Default.BarChart, Cyan500)
                        StatCard(Modifier.weight(1f), "Best Score", "$bestScore%", Icons.Default.EmojiEvents, Amber500)
                        StatCard(Modifier.weight(1f), "Pass Rate", "$passRate%", Icons.Default.TrendingUp, Violet400)
                    }
                }

                // ── SUBJECT BREAKDOWN ─────────────────────────────────
                if (bySubject.isNotEmpty()) {
                    item {
                        Text("BY SUBJECT", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = onSurfaceVar)
                        Spacer(modifier = Modifier.height(8.dp))
                        Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), color = AppColors.surfaceCard) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                bySubject.entries.forEach { (subject, results) ->
                                    val subAvg = results.map { it.score }.average().toInt()
                                    val subPassed = results.count { it.passed }
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(subject, fontSize = 13.sp, color = TextWhite, fontWeight = FontWeight.Medium,
                                                maxLines = 1, overflow = TextOverflow.Ellipsis)
                                            Text("${results.size} quiz${if (results.size != 1) "zes" else ""} • $subPassed passed",
                                                fontSize = 11.sp, color = onSurfaceVar)
                                        }
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Surface(shape = RoundedCornerShape(20.dp),
                                            color = (if (subAvg >= 70) Lime400 else Coral500).copy(alpha = 0.15f)) {
                                            Text("$subAvg%", fontSize = 13.sp, fontWeight = FontWeight.Bold,
                                                color = if (subAvg >= 70) Lime400 else Coral500,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
                                        }
                                    }
                                    if (bySubject.entries.last().key != subject)
                                        HorizontalDivider(color = TextWhite.copy(alpha = 0.05f))
                                }
                            }
                        }
                    }
                }

                // ── QUIZ HISTORY ──────────────────────────────────────
                item {
                    Text("QUIZ HISTORY", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = onSurfaceVar)
                    Spacer(modifier = Modifier.height(8.dp))
                }

                if (quizResults.isEmpty()) {
                    item {
                        Box(modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                            contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("📚", fontSize = 48.sp)
                                Spacer(modifier = Modifier.height(12.dp))
                                Text("No quizzes taken yet", fontSize = 15.sp, color = TextMuted, textAlign = TextAlign.Center)
                                Text("Complete a quiz to see your progress here", fontSize = 13.sp, color = TextDisabled, textAlign = TextAlign.Center)
                            }
                        }
                    }
                } else {
                    items(quizResults) { result ->
                        Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), color = AppColors.surfaceCard) {
                            Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier.size(42.dp)
                                        .background((if (result.passed) Lime400 else Coral500).copy(alpha = 0.15f), RoundedCornerShape(10.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        if (result.passed) Icons.Default.CheckCircle else Icons.Default.Refresh,
                                        null,
                                        tint = if (result.passed) Lime400 else Coral500,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        result.sectionTitle.ifBlank { result.subject.ifBlank { "Quiz" } },
                                        fontSize = 13.sp, color = TextWhite, fontWeight = FontWeight.Medium,
                                        maxLines = 1, overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        "${result.correctAnswers}/${result.totalQuestions} correct  •  ${result.difficulty}",
                                        fontSize = 11.sp, color = onSurfaceVar
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(
                                    "${result.score}%",
                                    fontSize = 18.sp, fontWeight = FontWeight.Black,
                                    color = if (result.passed) Lime400 else Coral500
                                )
                            }
                        }
                    }
                }

                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }
}

@Composable
private fun StatCard(modifier: Modifier, label: String, value: String, icon: ImageVector, iconColor: Color) {
    Surface(modifier = modifier, shape = RoundedCornerShape(14.dp), color = AppColors.surfaceCard) {
        Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, null, tint = iconColor, modifier = Modifier.size(22.dp))
            Spacer(modifier = Modifier.height(6.dp))
            Text(value, fontSize = 18.sp, fontWeight = FontWeight.Black, color = TextWhite)
            Text(label, fontSize = 10.sp, color = TextMuted, textAlign = TextAlign.Center)
        }
    }
}
