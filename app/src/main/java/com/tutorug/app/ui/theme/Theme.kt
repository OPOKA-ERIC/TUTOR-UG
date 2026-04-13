package com.tutorug.app.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.tutorug.app.viewmodel.AppTheme

// ── DEEP SPACE (default) ─────────────────────────────────────────────────────
private val SchemeDeepSpace = darkColorScheme(
    primary          = Amber500,
    onPrimary        = Ink900,
    primaryContainer = Ink700,
    secondary        = Cyan500,
    onSecondary      = Ink900,
    tertiary         = Violet400,
    background       = Ink900,
    onBackground     = TextWhite,
    surface          = Color(0xFF0F0F2E),
    onSurface        = TextWhite,
    surfaceVariant   = Color(0xFF161640),
    onSurfaceVariant = TextMuted,
    error            = Coral500,
    outline          = Color(0xFF2A2A5A)
)

// ── MIDNIGHT (AMOLED black) ───────────────────────────────────────────────────
private val SchemeMidnight = darkColorScheme(
    primary          = Amber500,
    onPrimary        = Color(0xFF000000),
    primaryContainer = Color(0xFF1A1A1A),
    secondary        = Cyan500,
    onSecondary      = Color(0xFF000000),
    tertiary         = Violet400,
    background       = Color(0xFF000000),
    onBackground     = TextWhite,
    surface          = Color(0xFF0D0D0D),
    onSurface        = TextWhite,
    surfaceVariant   = Color(0xFF1A1A1A),
    onSurfaceVariant = Color(0xFF888888),
    error            = Coral500,
    outline          = Color(0xFF333333)
)

// ── FOREST (dark green focus) ─────────────────────────────────────────────────
private val SchemeForest = darkColorScheme(
    primary          = Lime400,
    onPrimary        = Color(0xFF001A00),
    primaryContainer = Color(0xFF0A2010),
    secondary        = Amber500,
    onSecondary      = Color(0xFF001A00),
    tertiary         = Cyan500,
    background       = Color(0xFF050F05),
    onBackground     = TextWhite,
    surface          = Color(0xFF0A1A0A),
    onSurface        = TextWhite,
    surfaceVariant   = Color(0xFF102010),
    onSurfaceVariant = Color(0xFF88AA88),
    error            = Coral500,
    outline          = Color(0xFF1A3A1A)
)

// ── OCEAN (deep blue calm) ────────────────────────────────────────────────────
private val SchemeOcean = darkColorScheme(
    primary          = Cyan500,
    onPrimary        = Color(0xFF001A2A),
    primaryContainer = Color(0xFF001A2A),
    secondary        = Amber500,
    onSecondary      = Color(0xFF001A2A),
    tertiary         = Violet400,
    background       = Color(0xFF020D1A),
    onBackground     = TextWhite,
    surface          = Color(0xFF071525),
    onSurface        = TextWhite,
    surfaceVariant   = Color(0xFF0D2035),
    onSurfaceVariant = Color(0xFF6699BB),
    error            = Coral500,
    outline          = Color(0xFF1A3A55)
)

// ── SUNSET (warm dark) ────────────────────────────────────────────────────────
private val SchemeSunset = darkColorScheme(
    primary          = Coral400,
    onPrimary        = Color(0xFF1A0500),
    primaryContainer = Color(0xFF2A0A00),
    secondary        = Amber500,
    onSecondary      = Color(0xFF1A0500),
    tertiary         = Violet400,
    background       = Color(0xFF100500),
    onBackground     = TextWhite,
    surface          = Color(0xFF1A0A00),
    onSurface        = TextWhite,
    surfaceVariant   = Color(0xFF251000),
    onSurfaceVariant = Color(0xFFAA7755),
    error            = Coral500,
    outline          = Color(0xFF3A1A00)
)

fun colorSchemeFor(theme: AppTheme) = when (theme) {
    AppTheme.DEEP_SPACE -> SchemeDeepSpace
    AppTheme.MIDNIGHT   -> SchemeMidnight
    AppTheme.FOREST     -> SchemeForest
    AppTheme.OCEAN      -> SchemeOcean
    AppTheme.SUNSET     -> SchemeSunset
}

// Background gradient start/end per theme — used by all screens
fun themeBgGradient(theme: AppTheme): Pair<Color, Color> = when (theme) {
    AppTheme.DEEP_SPACE -> Pair(Color(0xFF0F0F2E), Color(0xFF05050F))
    AppTheme.MIDNIGHT   -> Pair(Color(0xFF0D0D0D), Color(0xFF000000))
    AppTheme.FOREST     -> Pair(Color(0xFF0A1A0A), Color(0xFF050F05))
    AppTheme.OCEAN      -> Pair(Color(0xFF071525), Color(0xFF020D1A))
    AppTheme.SUNSET     -> Pair(Color(0xFF1A0A00), Color(0xFF100500))
}

// Top bar gradient per theme
fun themeBarGradient(theme: AppTheme): Pair<Color, Color> = when (theme) {
    AppTheme.DEEP_SPACE -> Pair(Color(0xFF161640), Color(0xFF1E1E52))
    AppTheme.MIDNIGHT   -> Pair(Color(0xFF1A1A1A), Color(0xFF222222))
    AppTheme.FOREST     -> Pair(Color(0xFF102010), Color(0xFF183018))
    AppTheme.OCEAN      -> Pair(Color(0xFF0D2035), Color(0xFF153050))
    AppTheme.SUNSET     -> Pair(Color(0xFF251000), Color(0xFF301500))
}

val TutorUGTypography = Typography(
    headlineLarge  = TextStyle(fontWeight = FontWeight.Bold,     fontSize = 32.sp),
    headlineMedium = TextStyle(fontWeight = FontWeight.Bold,     fontSize = 24.sp),
    titleLarge     = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 20.sp),
    titleMedium    = TextStyle(fontWeight = FontWeight.Medium,   fontSize = 16.sp),
    bodyLarge      = TextStyle(fontWeight = FontWeight.Normal,   fontSize = 16.sp),
    bodyMedium     = TextStyle(fontWeight = FontWeight.Normal,   fontSize = 14.sp),
    bodySmall      = TextStyle(fontWeight = FontWeight.Normal,   fontSize = 12.sp),
    labelSmall     = TextStyle(fontWeight = FontWeight.Medium,   fontSize = 11.sp),
)

@Composable
fun TutorUGTheme(
    appTheme: AppTheme = AppTheme.DEEP_SPACE,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = colorSchemeFor(appTheme),
        typography  = TutorUGTypography,
        content     = content
    )
}
