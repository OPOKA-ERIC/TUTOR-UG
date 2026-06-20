package com.tutorug.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tutorug.app.ui.theme.*

@Composable
fun TermsOfServiceScreen(onBackClick: () -> Unit) {
    val bg       = AppColors.background
    val surface  = AppColors.surface
    val barStart = AppColors.barStart
    val barEnd   = AppColors.barEnd

    Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(surface, bg)))) {
        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {

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
                    Text("Terms of Service", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize().navigationBarsPadding(),
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Text("Effective: January 2025", fontSize = 12.sp, color = TextMuted)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "By using TutorUG, you agree to these Terms of Service. Please read them carefully before using the app.",
                        fontSize = 14.sp, color = TextLight, lineHeight = 22.sp
                    )
                }
                item { TermsSection("1. Acceptance of Terms",
                    "By creating an account and using TutorUG, you confirm that you are at least 8 years old or have parental consent, and that you agree to be bound by these terms.") }
                item { TermsSection("2. Use of the Service",
                    "TutorUG is an AI-powered educational platform designed for Ugandan students. You may use the service for personal, non-commercial educational purposes only. You must not misuse the platform, attempt to reverse-engineer it, or use it to generate harmful content.") }
                item { TermsSection("3. User Accounts",
                    "You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate information during registration. TutorUG reserves the right to suspend accounts that violate these terms.") }
                item { TermsSection("4. AI-Generated Content",
                    "TutorUG uses Anthropic Claude AI to generate educational responses. While we strive for accuracy, AI responses may occasionally contain errors. Always verify important information with your teachers or official curriculum materials.") }
                item { TermsSection("5. Uploaded Content",
                    "You retain ownership of documents and notes you upload. By uploading content, you grant TutorUG a limited licence to process and analyse it solely for the purpose of providing educational assistance to you.") }
                item { TermsSection("6. Prohibited Conduct",
                    "You must not use TutorUG to cheat in examinations, upload copyrighted material without permission, harass other users, attempt to access other users' data, or use the service for any illegal purpose.") }
                item { TermsSection("7. Service Availability",
                    "TutorUG is provided on an 'as is' basis. We do not guarantee uninterrupted access. We may update, modify, or discontinue features at any time with reasonable notice.") }
                item { TermsSection("8. Limitation of Liability",
                    "TutorUG and its founders shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability shall not exceed the amount you paid for the service in the past 12 months.") }
                item { TermsSection("9. Changes to Terms",
                    "We may update these terms from time to time. Continued use of TutorUG after changes constitutes acceptance of the new terms. We will notify users of significant changes via the app.") }
                item { TermsSection("10. Contact",
                    "For questions about these Terms, contact us at:\n\nEmail: info@tutorug.com\nTutorUG, Uganda 🇺🇬") }
                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }
}

@Composable
private fun TermsSection(title: String, body: String) {
    Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), color = AppColors.surfaceCard) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Cyan500)
            Spacer(modifier = Modifier.height(8.dp))
            Text(body, fontSize = 13.sp, color = TextLight, lineHeight = 21.sp)
        }
    }
}
