package com.tutorug.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color

// ── Theme-aware color aliases ─────────────────────────────────────────────────
// All screens must use these instead of hardcoded constants so theme changes
// propagate everywhere automatically.

object AppColors {
    val background: Color   @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.background
    val surface: Color      @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.surface
    val surfaceVar: Color   @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.surfaceVariant
    val primary: Color      @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.primary
    val onPrimary: Color    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.onPrimary
    val secondary: Color    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.secondary
    val tertiary: Color     @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.tertiary
    val outline: Color      @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.outline
    val error: Color        @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.error
    val onSurface: Color    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.onSurface
    val onSurfaceVar: Color @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.onSurfaceVariant
    val container: Color    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.primaryContainer

    // Derived surfaces — slightly lighter/darker than base surface
    val surfaceInput: Color @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.surfaceVariant
    val surfaceCard: Color  @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.surface

    // Bar gradient (top bar) — surface → surfaceVariant
    val barStart: Color @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.surface
    val barEnd: Color   @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.surfaceVariant

    // Background gradient — background → a slightly darker shade
    val bgTop: Color    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.surface
    val bgBottom: Color @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.background

    // ── Theme-aware text colors — use these instead of hardcoded TextWhite/TextMuted ─────────────
    // Primary text (white on dark, near-black on light)
    val textPrimary: Color  @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.onSurface
    // Secondary/muted text
    val textMuted: Color    @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.onSurfaceVariant
    // Disabled text
    val textDisabled: Color @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.45f)
    // Divider / subtle border
    val divider: Color      @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)
}
