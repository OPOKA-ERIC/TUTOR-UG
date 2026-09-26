package com.tutorug.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tutorug.app.data.model.UserProfile
import com.tutorug.app.ui.theme.*
import com.tutorug.app.viewmodel.FeedbackViewModel

/**
 * Feedback intake for the "Rate TutorUG" entry in Settings.
 *
 * Deliberately does NOT ask the student to categorise their own report. The
 * comment is the only required field: a bug report and a compliment are very
 * different things to write, and forcing a star rating first is what pushed
 * crash reports into a 1-star review bucket. The triage pass assigns the
 * category, urgency and summary afterwards.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedbackScreen(
    userProfile: UserProfile = UserProfile(),
    viewModel: FeedbackViewModel = viewModel(),
    onBackClick: () -> Unit = {},
    appVersion: String = "1.0.0"
) {
    var comment by remember { mutableStateOf("") }
    var title by remember { mutableStateOf("") }
    var rating by remember { mutableStateOf<Int?>(null) }
    var sent by remember { mutableStateOf(false) }

    val state by viewModel.state.collectAsState()
    val myReviews by viewModel.myReviews.collectAsState()
    val loadingHistory by viewModel.loadingHistory.collectAsState()

    LaunchedEffect(userProfile.userId) {
        if (userProfile.userId.isNotBlank()) viewModel.loadMyReviews(userProfile.userId)
    }

    val primary = AppColors.primary
    val surface = AppColors.surface
    val surfaceVar = AppColors.surfaceVar
    val textPrimary = AppColors.textPrimary
    val textMuted = AppColors.textMuted
    val textDisabled = AppColors.textDisabled
    val error = AppColors.error

    val submitting = state is FeedbackViewModel.UiState.Submitting
    val canSubmit = comment.isNotBlank() && comment.trim().length >= 10 && !submitting

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(surface, AppColors.background)))
    ) {
        // ── Top bar ─────────────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBackClick) {
                Icon(Icons.Default.ArrowBack, "Back", tint = textPrimary)
            }
            Text(
                "Send Feedback",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = textPrimary,
                modifier = Modifier.weight(1f)
            )
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
        ) {
            Text(
                "Tell us what is working and what is not.",
                fontSize = 14.sp,
                color = textMuted
            )
            Spacer(modifier = Modifier.height(18.dp))

            // ── Optional star rating ────────────────────────────────────
            // Optional on purpose. Nobody should have to rate the app to
            // report that they cannot log in.
            Text("How is TutorUG working for you?", fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold, color = textPrimary)
            Spacer(modifier = Modifier.height(4.dp))
            Text("Optional. Skip it if you just want to report a problem.",
                fontSize = 11.sp, color = textDisabled)
            Spacer(modifier = Modifier.height(10.dp))
            Row {
                (1..5).forEach { star ->
                    Icon(
                        imageVector = if (rating != null && star <= rating!!) Icons.Default.Star
                                      else Icons.Default.StarBorder,
                        contentDescription = "Rate $star out of 5",
                        tint = if (rating != null && star <= rating!!) Amber400 else textDisabled,
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .clickable { rating = if (rating == star) null else star }
                            .padding(3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // ── Comment ─────────────────────────────────────────────────
            Text("What would you like us to know?", fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold, color = textPrimary)
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = comment,
                onValueChange = { if (it.length <= 2000) comment = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 130.dp),
                placeholder = {
                    Text("For example: the chat did not send my message this morning",
                        color = textDisabled, fontSize = 13.sp)
                },
                textStyle = androidx.compose.ui.text.TextStyle(
                    color = textPrimary, fontSize = 14.sp
                ),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = primary,
                    unfocusedBorderColor = AppColors.divider,
                    focusedTextColor = textPrimary,
                    unfocusedTextColor = textPrimary,
                    cursorColor = primary
                ),
                shape = RoundedCornerShape(12.dp)
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                val tooShort = comment.isNotBlank() && comment.trim().length < 10
                Text(
                    when {
                        comment.length > 1900 -> "${2000 - comment.length} characters left"
                        tooShort -> "A little more detail helps us act on it"
                        else -> "${comment.length} characters"
                    },
                    fontSize = 11.sp,
                    color = if (tooShort) error else textDisabled
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // ── Error ───────────────────────────────────────────────────
            (state as? FeedbackViewModel.UiState.Error)?.let { err ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(error.copy(alpha = 0.12f), RoundedCornerShape(10.dp))
                        .border(1.dp, error.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(err.message, color = error, fontSize = 12.sp)
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            // ── Submitted confirmation ──────────────────────────────────
            if (sent) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(primary.copy(alpha = 0.12f), RoundedCornerShape(10.dp))
                        .border(1.dp, primary.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.CheckCircle, null, tint = primary,
                        modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Thank you. Your feedback was sent to the team.",
                        color = primary, fontSize = 12.sp)
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            // ── Submit ──────────────────────────────────────────────────
            Button(
                onClick = {
                    sent = false
                    viewModel.submit(
                        userId = userProfile.userId,
                        title = title.ifBlank { comment.trim().take(60) },
                        comment = comment.trim(),
                        rating = rating,
                        appVersion = appVersion,
                        screen = "settings_feedback"
                    ) {
                        comment = ""; title = ""; rating = null; sent = true
                    }
                },
                enabled = canSubmit,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = primary,
                    disabledContainerColor = surfaceVar
                )
            ) {
                if (submitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = AppColors.onPrimary
                    )
                } else {
                    Text(
                        "Send feedback",
                        fontWeight = FontWeight.Bold,
                        color = if (canSubmit) AppColors.onPrimary else textDisabled
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // ── Previously sent ─────────────────────────────────────────
            HorizontalDivider(color = AppColors.divider)
            Spacer(modifier = Modifier.height(14.dp))
            Text("Your recent feedback", fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold, color = textPrimary)
            Spacer(modifier = Modifier.height(8.dp))

            when {
                loadingHistory -> Text("Loading…", fontSize = 12.sp, color = textDisabled)
                myReviews.isEmpty() -> Text(
                    "You have not sent any feedback yet.",
                    fontSize = 12.sp, color = textDisabled
                )
                else -> myReviews.forEach { review ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp)
                            .background(surfaceVar, RoundedCornerShape(10.dp))
                            .padding(12.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                review.title.ifBlank { "Feedback" },
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = textPrimary,
                                maxLines = 1,
                                modifier = Modifier.weight(1f)
                            )
                            review.rating?.let {
                                Text("$it/5", fontSize = 11.sp, color = Amber400,
                                    fontWeight = FontWeight.Bold)
                            }
                        }
                        if (review.comment.isNotBlank()) {
                            Spacer(modifier = Modifier.height(3.dp))
                            Text(review.comment, fontSize = 12.sp, color = textMuted,
                                maxLines = 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
