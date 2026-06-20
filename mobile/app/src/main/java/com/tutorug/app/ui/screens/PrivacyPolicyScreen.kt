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
fun PrivacyPolicyScreen(onBackClick: () -> Unit) {
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
                    Text("Privacy Policy", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize().navigationBarsPadding(),
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Text("Last updated: January 2025", fontSize = 12.sp, color = TextMuted)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "TutorUG is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information.",
                        fontSize = 14.sp, color = TextLight, lineHeight = 22.sp
                    )
                }
                item { PolicySection("1. Information We Collect",
                    "We collect information you provide during registration including your name, email address, district, education level, school, and course or profession. We also collect chat messages, quiz results, and uploaded documents to provide our learning services.") }
                item { PolicySection("2. How We Use Your Information",
                    "Your information is used solely to personalise your learning experience on TutorUG. We use your district and education level to provide localised Ugandan content. Your chat history and quiz results are used to track your progress and improve AI responses.") }
                item { PolicySection("3. Data Storage & Security",
                    "All data is stored securely on Supabase servers with AES-256 encryption at rest and TLS encryption in transit. Your documents are stored in private storage buckets accessible only to you. API keys and sensitive credentials are never stored on your device.") }
                item { PolicySection("4. Data Sharing",
                    "We do not sell, trade, or share your personal information with third parties. Your data is only shared with our AI provider (Anthropic Claude) to generate educational responses, and only the minimum necessary context is sent.") }
                item { PolicySection("5. Profile Pictures",
                    "Profile pictures you upload are stored in a public storage bucket solely for display purposes within the app. You can change or remove your profile picture at any time from Settings.") }
                item { PolicySection("6. Children's Privacy",
                    "TutorUG serves students from Primary level upwards. We take extra care to protect the privacy of younger users. We do not knowingly collect unnecessary personal information from children.") }
                item { PolicySection("7. Your Rights",
                    "You have the right to access, correct, or delete your personal data at any time. You can delete your account by contacting us at info@tutorug.com. Upon deletion, all your data including messages, quiz results, and documents will be permanently removed.") }
                item { PolicySection("8. Contact Us",
                    "If you have any questions about this Privacy Policy, please contact us at:\n\nEmail: info@tutorug.com\nTutorUG, Uganda 🇺🇬") }
                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }
}

@Composable
private fun PolicySection(title: String, body: String) {
    Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), color = AppColors.surfaceCard) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Amber500)
            Spacer(modifier = Modifier.height(8.dp))
            Text(body, fontSize = 13.sp, color = TextLight, lineHeight = 21.sp)
        }
    }
}
