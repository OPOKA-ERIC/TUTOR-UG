package com.tutorug.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.tutorug.app.R
import com.tutorug.app.ui.theme.Amber400
import com.tutorug.app.ui.theme.Amber600

@Composable
fun AppLogo(size: Dp = 36.dp) {
    Image(
        painter = painterResource(id = R.drawable.ic_tutorug_logo),
        contentDescription = "TutorUG Logo",
        contentScale = ContentScale.Fit,
        modifier = Modifier
            .size(size)
            .background(
                Brush.linearGradient(listOf(Amber400, Amber600)),
                RoundedCornerShape(10.dp)
            )
            .clip(RoundedCornerShape(10.dp))
    )
}
