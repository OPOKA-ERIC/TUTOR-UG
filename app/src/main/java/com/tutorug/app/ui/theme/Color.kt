package com.tutorug.app.ui.theme

import androidx.compose.ui.graphics.Color

// ── BASE BACKGROUNDS ─────────────────────────────────────────────────────────
// Deep indigo-black: focus, depth, trust — used by top learning apps
val Ink900  = Color(0xFF0A0A1F)   // Deepest background
val Ink800  = Color(0xFF0F0F2E)   // Main background
val Ink700  = Color(0xFF161640)   // Card background
val Ink600  = Color(0xFF1E1E52)   // Elevated card / input

// ── PRIMARY ACCENT — Amber Gold ───────────────────────────────────────────────
// Triggers dopamine reward response — achievement, progress, CTA
val Amber400 = Color(0xFFFFD000)
val Amber500 = Color(0xFFFFC107)
val Amber600 = Color(0xFFFFAB00)

// ── SUCCESS — Electric Green ──────────────────────────────────────────────────
// Correct answers, progress, streaks — strongest positive reinforcement color
val Lime400 = Color(0xFF00E676)
val Lime500 = Color(0xFF00C853)
val Lime600 = Color(0xFF00A846)

// ── ENERGY — Coral Orange ─────────────────────────────────────────────────────
// Motivation, urgency, warmth — less anxiety-inducing than red
val Coral400 = Color(0xFFFF6B6B)
val Coral500 = Color(0xFFFF5252)
val Coral600 = Color(0xFFE53935)

// ── CURIOSITY — Electric Violet ───────────────────────────────────────────────
// Creativity, AI feel, premium — sparks curiosity and exploration
val Violet400 = Color(0xFF9C6FFF)
val Violet500 = Color(0xFF7C4DFF)
val Violet600 = Color(0xFF651FFF)

// ── FOCUS — Cyan Teal ────────────────────────────────────────────────────────
// Calm focus, secondary accent, voice/AI indicators
val Cyan400 = Color(0xFF18FFFF)
val Cyan500 = Color(0xFF00E5FF)
val Cyan600 = Color(0xFF00B8D4)

// ── TEXT ─────────────────────────────────────────────────────────────────────
val TextWhite    = Color(0xFFFFFFFF)
val TextLight    = Color(0xFFE8E8FF)
val TextMuted    = Color(0xFF8888BB)
val TextDisabled = Color(0xFF44446A)

// ── SURFACES ─────────────────────────────────────────────────────────────────
val SurfaceBase  = Color(0xFF0F0F2E)
val SurfaceCard  = Color(0xFF161640)
val SurfaceInput = Color(0xFF1E1E52)
val SurfaceHover = Color(0xFF252560)

// ── CHAT BUBBLES ─────────────────────────────────────────────────────────────
val BubbleUser = Color(0xFF1A3A6E)
val BubbleAI   = Color(0xFF161640)

// ── LEGACY ALIASES — keeps all existing screens compiling ────────────────────
val Brand900      = Ink900
val Brand800      = Ink800
val Brand700      = Ink700
val Brand600      = Ink600
val Gold400       = Amber400
val Gold500       = Amber500
val Gold600       = Amber600
val Gold500Light  = Amber500.copy(alpha = 0.15f)
val Teal400       = Cyan500
val Teal500       = Cyan600
val Purple400     = Violet400
val Purple500     = Violet500
val Orange400     = Coral400
val Orange500     = Coral500
val Orange600     = Coral600
val Crimson400    = Coral500
val GradientStart = Ink700
val GradientMid   = Ink800
val GradientEnd   = Ink900
val TextPrimary   = TextWhite
val TextSecondary = TextMuted
val SurfaceDark   = SurfaceBase
val GreenPass     = Lime500
val BlueBadge     = Cyan500
val Success       = Lime500
val Warning       = Amber500
val Error         = Coral500
val UgandaBlack   = Ink900
val UgandaGold    = Amber500
val UgandaRed     = Coral500
