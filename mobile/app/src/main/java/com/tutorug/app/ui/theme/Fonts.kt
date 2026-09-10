package com.tutorug.app.ui.theme

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.tutorug.app.R

// Rounded, friendly display family (Baloo 2, OFL) — matches the playful graduation-cap mascot.
// Registered for the heavy display weights used across headings and CTAs.
val Baloo = FontFamily(
    Font(R.font.baloo2_regular, FontWeight.Normal),
    Font(R.font.baloo2_medium, FontWeight.Medium),
    Font(R.font.baloo2_bold, FontWeight.Bold),
    Font(R.font.baloo2_extrabold, FontWeight.Black)
)