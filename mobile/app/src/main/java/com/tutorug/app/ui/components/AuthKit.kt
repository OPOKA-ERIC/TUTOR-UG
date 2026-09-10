package com.tutorug.app.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tutorug.app.ui.theme.Amber400
import com.tutorug.app.ui.theme.Amber500
import com.tutorug.app.ui.theme.Amber600
import com.tutorug.app.ui.theme.AppColors
import com.tutorug.app.ui.theme.Baloo

// ── AuthBackdrop: shared deep-indigo → navy backdrop with warm amber halo ──────
// and the kitenge-inspired geometric texture used across onboarding screens.
@Composable
fun AuthBackdrop(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    val bg = AppColors.background
    val surface = AppColors.surface
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    0.0f to Color(0xFF251B4A),   // warm indigo near the top
                    0.5f to surface,
                    1f to bg                       // deep navy at the base
                )
            )
    ) {
        KitengePattern(modifier = Modifier.fillMaxSize())
        Box(
            modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth().height(420.dp).offset(y = (-120).dp)
                .background(
                    Brush.radialGradient(
                        listOf(Amber500.copy(alpha = 0.20f), Amber600.copy(alpha = 0.07f), Color.Transparent)
                    )
                )
        )
        content()
    }
}

// ── GoldTextField: translucent fill + 1dp gold→transparent gradient border ────
// that brightens on focus. Standard input across the onboarding flow.
@Composable
fun AuthTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String = "",
    leadingIcon: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    password: Boolean = false,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    isError: Boolean = false,
    supportingText: (@Composable () -> Unit)? = null,
    singleLine: Boolean = true
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = label?.let { l ->
            { Text(l, color = if (isError) AppColors.error else AppColors.onSurfaceVar) }
        },
        placeholder = { if (placeholder.isNotEmpty()) Text(placeholder, color = AppColors.textDisabled) },
        leadingIcon = leadingIcon?.let { icon ->
            { Box(Modifier.padding(start = 4.dp), contentAlignment = Alignment.Center) { icon() } }
        },
        trailingIcon = trailing,
        interactionSource = interactionSource,
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = keyboardOptions,
        isError = isError,
        supportingText = supportingText,
        singleLine = singleLine,
        shape = RoundedCornerShape(14.dp),
        modifier = modifier
            .fillMaxWidth()
            .background(AppColors.surfaceInput.copy(alpha = 0.55f), RoundedCornerShape(14.dp))
            .border(
                1.dp,
                Brush.linearGradient(
                    listOf(
                        Amber400.copy(alpha = if (isFocused) 0.95f else 0.45f),
                        AppColors.outline.copy(alpha = 0.10f)
                    )
                ),
                RoundedCornerShape(14.dp)
            ),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = AppColors.textPrimary,
            unfocusedTextColor = AppColors.textPrimary,
            focusedBorderColor = Color.Transparent,
            unfocusedBorderColor = Color.Transparent,
            focusedContainerColor = Color.Transparent,
            unfocusedContainerColor = Color.Transparent,
            cursorColor = Amber400,
            focusedLabelColor = Amber400,
            unfocusedLabelColor = AppColors.onSurfaceVar,
            errorBorderColor = Color.Transparent,
            errorContainerColor = Color.Transparent
        )
    )
}

// ── AuthDropdown: select field sharing AuthTextField's gold-gradient border, ──
// with a rotating gold chevron and a themed dropdown menu.
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthDropdown(
    value: String,
    label: String,
    options: List<String>,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    leadingIcon: (@Composable () -> Unit)? = null
) {
    var expanded by remember { mutableStateOf(false) }
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()
    val rotation by animateFloatAsState(if (expanded) 180f else 0f, label = "chevron")

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            label = { Text(label, color = if (isFocused) Amber400 else AppColors.onSurfaceVar) },
            placeholder = { if (placeholder.isNotEmpty()) Text(placeholder, color = AppColors.textDisabled) },
            leadingIcon = leadingIcon?.let { icon ->
                { Box(Modifier.padding(start = 4.dp), contentAlignment = Alignment.Center) { icon() } }
            },
            trailingIcon = {
                Icon(
                    Icons.Default.ArrowDropDown, "Open options", tint = Amber400,
                    modifier = Modifier.size(24.dp).graphicsLayer { rotationZ = rotation }
                )
            },
            interactionSource = interactionSource,
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            modifier = modifier
                .fillMaxWidth()
                .menuAnchor()
                .background(AppColors.surfaceInput.copy(alpha = 0.55f), RoundedCornerShape(14.dp))
                .border(
                    1.dp,
                    Brush.linearGradient(
                        listOf(
                            Amber400.copy(alpha = if (isFocused) 0.95f else 0.45f),
                            AppColors.outline.copy(alpha = 0.10f)
                        )
                    ),
                    RoundedCornerShape(14.dp)
                ),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = AppColors.textPrimary,
                unfocusedTextColor = AppColors.textPrimary,
                focusedBorderColor = Color.Transparent,
                unfocusedBorderColor = Color.Transparent,
                focusedContainerColor = Color.Transparent,
                unfocusedContainerColor = Color.Transparent,
                cursorColor = Amber400,
                focusedLabelColor = Amber400,
                unfocusedLabelColor = AppColors.onSurfaceVar,
                errorBorderColor = Color.Transparent,
                errorContainerColor = Color.Transparent
            )
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(AppColors.surface)
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = {
                        Text(option, color = AppColors.textPrimary, fontFamily = Baloo,
                            fontWeight = FontWeight.Medium)
                    },
                    onClick = { expanded = false; onSelected(option) }
                )
            }
        }
    }
}

// ── GoldButton: bright #FFD700 → #FF9500 gradient, gloss sheen, dark text ─────
// The primary action anchor across all onboarding screens.
@Composable
fun GoldButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false
) {
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
        contentPadding = PaddingValues(0.dp),
        enabled = enabled
    ) {
        val shine = if (enabled) 1f else 0.45f
        Box(
            modifier = Modifier.fillMaxSize()
                .shadow(8.dp, RoundedCornerShape(14.dp), clip = false)
                .background(
                    Brush.linearGradient(
                        listOf(Color(0xFFFFD700).copy(alpha = shine), Color(0xFFFF9500).copy(alpha = shine))
                    ),
                    RoundedCornerShape(14.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            Box(
                Modifier.fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.White.copy(alpha = if (enabled) 0.25f else 0.10f), Color.Transparent)
                        ),
                        RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp)
                    )
            )
            if (loading)
                CircularProgressIndicator(modifier = Modifier.size(22.dp), color = Color(0xFF1A1000), strokeWidth = 2.dp)
            else
                Text(label, fontFamily = Baloo, fontSize = 16.sp, fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF1A1000).copy(alpha = if (enabled) 1f else 0.7f))
        }
    }
}

// ── KitengePattern: low-opacity geometric motif echoing Ugandan textile design ─
@Composable
fun KitengePattern(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val step = 56.dp.toPx()
        val dia = 6.dp.toPx()
        val tri = 8.dp.toPx()
        var row = 0
        var y = step / 2f
        while (y < size.height) {
            var x = if (row % 2 == 0) step / 2f else step
            while (x < size.width) {
                if (row % 3 == 0) {
                    val triangle = Path().apply {
                        moveTo(x, y - tri)
                        lineTo(x + tri, y + tri * 0.8f)
                        lineTo(x - tri, y + tri * 0.8f)
                        close()
                    }
                    drawPath(triangle, color = Amber400.copy(alpha = 0.05f))
                } else {
                    val diamond = Path().apply {
                        moveTo(x, y - dia / 2f)
                        lineTo(x + dia / 2f, y)
                        lineTo(x, y + dia / 2f)
                        lineTo(x - dia / 2f, y)
                        close()
                    }
                    drawPath(diamond, color = Amber400.copy(alpha = if (row % 2 == 0) 0.045f else 0.03f))
                }
                x += step
            }
            row++
            y += step
        }
    }
}