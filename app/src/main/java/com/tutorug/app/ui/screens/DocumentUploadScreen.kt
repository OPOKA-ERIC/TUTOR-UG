package com.tutorug.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tutorug.app.data.model.ChatSession
import com.tutorug.app.data.model.UploadedDocument
import com.tutorug.app.ui.theme.*
import com.tutorug.app.util.Constants
import com.tutorug.app.viewmodel.DocumentViewModel
import com.tutorug.app.viewmodel.UploadState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentUploadScreen(
    viewModel: DocumentViewModel,
    userId: String,
    educationLevel: String,
    chatHistory: List<ChatSession> = emptyList(),
    onBackClick: () -> Unit,
    onUploadSuccess: (String) -> Unit,
    onDocumentClick: (String) -> Unit = {},
    onDeleteSession: (String) -> Unit = {}
) {
    val uploadState by viewModel.uploadState.collectAsState()
    val documents   by viewModel.documents.collectAsState()

    var selectedUri      by remember { mutableStateOf<Uri?>(null) }
    var selectedFileName by remember { mutableStateOf("") }
    var selectedSubject  by remember { mutableStateOf("") }
    var subjectExpanded  by remember { mutableStateOf(false) }
    val context = androidx.compose.ui.platform.LocalContext.current

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            selectedUri = it
            // Get the real filename from the URI
            selectedFileName = context.contentResolver.query(it, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                cursor.moveToFirst()
                if (nameIndex >= 0) cursor.getString(nameIndex) else null
            } ?: "document_${System.currentTimeMillis()}"
        }
    }

    val subjects = Constants.getSubjectsForLevel(educationLevel)

    // Load existing documents on entry
    LaunchedEffect(userId) { viewModel.loadUserDocuments(userId) }

    val bg           = AppColors.background
    val surface      = AppColors.surface
    val primary      = AppColors.primary
    val onPrimary    = AppColors.onPrimary
    val secondary    = AppColors.secondary
    val tertiary     = AppColors.tertiary
    val outline      = AppColors.outline
    val surfaceInput = AppColors.surfaceInput
    val onSurfaceVar = AppColors.onSurfaceVar
    val barStart     = AppColors.barStart
    val barEnd       = AppColors.barEnd
    val error        = AppColors.error

    Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(surface, bg)))) {
        Box(
            modifier = Modifier.size(240.dp).align(Alignment.TopEnd).offset(x = 60.dp, y = (-40).dp)
                .background(Brush.radialGradient(listOf(secondary.copy(alpha = 0.1f), Color.Transparent)), CircleShape)
        )

        Column(modifier = Modifier.fillMaxSize().statusBarsPadding()) {

            // ── TOP BAR ──────────────────────────────────────────────
            Box(
                modifier = Modifier.fillMaxWidth()
                    .background(Brush.horizontalGradient(listOf(barStart, barEnd)))
                    .padding(horizontal = 8.dp, vertical = 8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .noRippleClickable { onBackClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Box(modifier = Modifier.size(36.dp).background(surfaceInput, CircleShape),
                            contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.ArrowBack, null, tint = TextWhite, modifier = Modifier.size(18.dp))
                        }
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                    AppLogo()
                    Spacer(modifier = Modifier.width(10.dp))
                    Text("Upload Notes", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                }
            }

            Column(
                modifier = Modifier.fillMaxSize().imePadding().navigationBarsPadding()
                    .verticalScroll(rememberScrollState()).padding(24.dp)
            ) {
                Spacer(modifier = Modifier.height(4.dp))

                // ── DROP ZONE ─────────────────────────────────────────
                val fileSelected = selectedUri != null
                Box(
                    modifier = Modifier.fillMaxWidth().height(180.dp)
                        .clip(RoundedCornerShape(16.dp)).background(surface)
                        .border(
                            width = 2.dp,
                            brush = if (fileSelected)
                                Brush.linearGradient(listOf(Lime400, Lime600))
                            else
                                Brush.linearGradient(listOf(primary.copy(alpha = 0.5f), tertiary.copy(alpha = 0.5f))),
                            shape = RoundedCornerShape(16.dp)
                        )
                        .clickable { launcher.launch("*/*") },
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(16.dp)) {
                        Icon(
                            if (fileSelected) Icons.Default.CheckCircle else Icons.Default.CloudUpload,
                            null,
                            tint = if (fileSelected) Lime400 else primary,
                            modifier = Modifier.size(56.dp)
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            if (fileSelected) "Document selected ✓" else "Tap to select document",
                            color = if (fileSelected) Lime400 else onSurfaceVar,
                            fontSize = 15.sp, fontWeight = FontWeight.Medium
                        )
                        if (fileSelected)
                            Text(selectedFileName, color = TextDisabled, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                        else {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("PDF • Image • DOCX • PPTX • TXT", color = TextDisabled, fontSize = 12.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // ── SUBJECT DROPDOWN ──────────────────────────────────
                ExposedDropdownMenuBox(expanded = subjectExpanded, onExpandedChange = { subjectExpanded = it }) {
                    OutlinedTextField(
                        value = selectedSubject, onValueChange = {}, readOnly = true,
                        label = { Text("Select Subject") },
                        trailingIcon = { Icon(Icons.Default.ArrowDropDown, null, tint = primary) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextWhite, unfocusedTextColor = TextLight,
                            focusedBorderColor = primary, unfocusedBorderColor = outline,
                            focusedContainerColor = surfaceInput, unfocusedContainerColor = surfaceInput,
                            focusedLabelColor = primary, unfocusedLabelColor = onSurfaceVar
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )
                    ExposedDropdownMenu(expanded = subjectExpanded, onDismissRequest = { subjectExpanded = false },
                        modifier = Modifier.background(surface)) {
                        subjects.forEach { subject ->
                            DropdownMenuItem(text = { Text(subject, color = TextWhite) },
                                onClick = { selectedSubject = subject; subjectExpanded = false })
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ── AI INFO HINT ──────────────────────────────────────
                Surface(modifier = Modifier.fillMaxWidth(), color = secondary.copy(alpha = 0.08f), shape = RoundedCornerShape(12.dp)) {
                    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.AutoAwesome, null, tint = secondary, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(10.dp))
                        Text("TutorUG AI will scan your notes and create personalised learning units.",
                            fontSize = 13.sp, color = onSurfaceVar)
                    }
                }

                if (uploadState is UploadState.Error) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Surface(shape = RoundedCornerShape(10.dp), color = error.copy(alpha = 0.12f)) {
                        Text((uploadState as UploadState.Error).message, color = error, fontSize = 13.sp,
                            modifier = Modifier.padding(12.dp))
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // ── UPLOAD BUTTON ─────────────────────────────────────
                val canUpload = uploadState !is UploadState.Uploading && selectedUri != null && selectedSubject.isNotBlank()
                Button(
                    onClick = {
                        selectedUri?.let {
                            viewModel.uploadDocument(userId, it, selectedFileName, selectedSubject, educationLevel)
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                    contentPadding = PaddingValues(0.dp), enabled = canUpload
                ) {
                    Box(
                        modifier = Modifier.fillMaxSize().background(
                            if (canUpload) Brush.linearGradient(listOf(Amber400, Amber600))
                            else Brush.linearGradient(listOf(surfaceInput, surfaceInput)),
                            RoundedCornerShape(14.dp)
                        ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (uploadState is UploadState.Uploading)
                            CircularProgressIndicator(modifier = Modifier.size(24.dp), color = onPrimary, strokeWidth = 2.dp)
                        else
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.AutoAwesome, null, tint = onPrimary, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Analyse with AI", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = onPrimary)
                            }
                    }
                }

                // ── YOUR DOCUMENTS ────────────────────────────────
                if (documents.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(28.dp))
                    Text("YOUR DOCUMENTS", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = onSurfaceVar,
                        modifier = Modifier.padding(horizontal = 2.dp))
                    Spacer(modifier = Modifier.height(10.dp))
                    documents.forEach { doc ->
                        DocumentCard(
                            doc = doc,
                            surface = surface,
                            primary = primary,
                            onSurfaceVar = onSurfaceVar,
                            error = error,
                            onClick = { if (doc.status == "ready") onDocumentClick(doc.documentId) },
                            onDelete = { viewModel.deleteDocument(doc.documentId, userId) }
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }

                // ── LEARNING SESSIONS (chat history for this user) ────
                if (chatHistory.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(28.dp))
                    Text("LEARNING SESSIONS", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = onSurfaceVar,
                        modifier = Modifier.padding(horizontal = 2.dp))
                    Spacer(modifier = Modifier.height(10.dp))
                    chatHistory.forEach { session ->
                        var showDeleteConfirm by remember { mutableStateOf(false) }

                        if (showDeleteConfirm) {
                            AlertDialog(
                                onDismissRequest = { showDeleteConfirm = false },
                                containerColor = AppColors.surfaceCard,
                                shape = RoundedCornerShape(16.dp),
                                title = { Text("Delete Session?", color = TextWhite, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
                                text = { Text("This will permanently delete this chat session and all its messages.", color = onSurfaceVar, fontSize = 13.sp) },
                                confirmButton = {
                                    Button(
                                        onClick = { onDeleteSession(session.sessionId); showDeleteConfirm = false },
                                        colors = ButtonDefaults.buttonColors(containerColor = error),
                                        shape = RoundedCornerShape(8.dp)
                                    ) { Text("Delete", fontWeight = FontWeight.Bold) }
                                },
                                dismissButton = {
                                    TextButton(onClick = { showDeleteConfirm = false }) {
                                        Text("Cancel", color = onSurfaceVar)
                                    }
                                }
                            )
                        }

                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            color = surface,
                            border = ButtonDefaults.outlinedButtonBorder.copy(
                                brush = androidx.compose.ui.graphics.SolidColor(primary.copy(alpha = 0.2f)), width = 1.dp
                            )
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier.size(40.dp)
                                        .background(primary.copy(alpha = 0.12f), RoundedCornerShape(10.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.Chat, null, tint = primary, modifier = Modifier.size(20.dp))
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        session.subject.ifBlank { "Learning Session" },
                                        fontSize = 14.sp, color = TextWhite,
                                        fontWeight = FontWeight.Medium,
                                        maxLines = 1, overflow = TextOverflow.Ellipsis
                                    )
                                    session.messages.lastOrNull()?.let {
                                        Text(
                                            it.content,
                                            fontSize = 11.sp, color = onSurfaceVar,
                                            maxLines = 1, overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    if (session.messageCount > 0) {
                                        Text(
                                            "${session.messageCount} messages",
                                            fontSize = 11.sp, color = primary
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.width(4.dp))
                                Box(
                                    modifier = Modifier.size(32.dp).noRippleClickable { showDeleteConfirm = true },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.Delete, null,
                                        tint = error.copy(alpha = 0.7f), modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
            }
        }

        if (uploadState is UploadState.Uploading || uploadState is UploadState.Processing) {
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.6f)).clickable(enabled = false) {},
                contentAlignment = Alignment.Center) {
                Surface(shape = RoundedCornerShape(20.dp), color = surface) {
                    Column(modifier = Modifier.padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = primary, strokeWidth = 3.dp)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            if (uploadState is UploadState.Uploading)
                                "Uploading your document..."
                            else
                                "AI is reading and analysing your notes...",
                            color = TextLight, fontSize = 14.sp
                        )
                        if (uploadState is UploadState.Processing) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("This may take up to 30 seconds", color = TextDisabled, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // ── AI RESULTS OVERLAY ────────────────────────────────────
        if (uploadState is UploadState.Ready) {
            val readyState = uploadState as UploadState.Ready
            Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.85f)),
                contentAlignment = Alignment.Center) {
                Surface(
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                    shape = RoundedCornerShape(20.dp),
                    color = surface
                ) {
                    Column(modifier = Modifier.padding(24.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier.size(40.dp)
                                    .background(Brush.linearGradient(listOf(Amber400, Amber600)), CircleShape),
                                contentAlignment = Alignment.Center
                            ) { Text("AI", fontSize = 12.sp, fontWeight = FontWeight.Black, color = onPrimary) }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("Analysis Complete!", fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold, color = Lime400)
                                Text("${readyState.sections.size} learning sections created",
                                    fontSize = 12.sp, color = onSurfaceVar)
                            }
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        HorizontalDivider(color = TextWhite.copy(alpha = 0.08f))
                        Spacer(modifier = Modifier.height(12.dp))
                        readyState.sections.forEachIndexed { i, section ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Box(
                                    modifier = Modifier.size(24.dp)
                                        .background(primary.copy(alpha = 0.15f), CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("${i + 1}", fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold, color = primary)
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(section.title, fontSize = 13.sp,
                                    color = TextWhite, fontWeight = FontWeight.Medium)
                            }
                        }
                        Spacer(modifier = Modifier.height(20.dp))
                        Button(
                            onClick = {
                                onUploadSuccess(readyState.documentId)
                                viewModel.resetUploadState()
                            },
                            modifier = Modifier.fillMaxWidth().height(50.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Box(
                                modifier = Modifier.fillMaxSize()
                                    .background(Brush.linearGradient(listOf(Amber400, Amber600)),
                                        RoundedCornerShape(14.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("Start Learning", fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold, color = onPrimary)
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        TextButton(
                            onClick = { viewModel.resetUploadState() },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Upload Another Document", color = onSurfaceVar, fontSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DocumentCard(
    doc: UploadedDocument,
    surface: Color,
    primary: Color,
    onSurfaceVar: Color,
    error: Color,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    var showDeleteConfirm by remember { mutableStateOf(false) }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            containerColor = AppColors.surfaceCard,
            shape = RoundedCornerShape(16.dp),
            title = { Text("Delete Document?", color = TextWhite, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = { Text("This will permanently delete this document and all its learning sections.", color = onSurfaceVar, fontSize = 13.sp) },
            confirmButton = {
                Button(
                    onClick = { onDelete(); showDeleteConfirm = false },
                    colors = ButtonDefaults.buttonColors(containerColor = error),
                    shape = RoundedCornerShape(8.dp)
                ) { Text("Delete", fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel", color = onSurfaceVar)
                }
            }
        )
    }

    val statusColor = when (doc.status) {
        "ready"   -> Lime400
        "failed"  -> Coral500
        else      -> Amber500
    }
    val statusLabel = when (doc.status) {
        "ready"   -> "Ready"
        "failed"  -> "Failed"
        else      -> "Processing…"
    }
    val isReady = doc.status == "ready"

    Surface(
        modifier = Modifier.fillMaxWidth().noRippleClickable { if (isReady) onClick() },
        shape = RoundedCornerShape(12.dp),
        color = surface,
        border = if (isReady) ButtonDefaults.outlinedButtonBorder.copy(
            brush = androidx.compose.ui.graphics.SolidColor(primary.copy(alpha = 0.3f)), width = 1.dp
        ) else null
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(42.dp)
                    .background(primary.copy(alpha = 0.12f), RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    if (isReady) Icons.Default.MenuBook else Icons.Default.Description,
                    null, tint = if (isReady) primary else onSurfaceVar,
                    modifier = Modifier.size(22.dp)
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    doc.subject.ifBlank { doc.fileName },
                    fontSize = 14.sp, color = TextWhite,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1, overflow = TextOverflow.Ellipsis
                )
                Text(
                    doc.fileName, fontSize = 11.sp, color = onSurfaceVar,
                    maxLines = 1, overflow = TextOverflow.Ellipsis
                )
                if (isReady) {
                    Text(
                        "${doc.sectionCount} sections  •  Tap to continue learning",
                        fontSize = 11.sp, color = primary
                    )
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Surface(shape = RoundedCornerShape(20.dp), color = statusColor.copy(alpha = 0.15f)) {
                Text(statusLabel, fontSize = 10.sp, color = statusColor, fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
            }
            Spacer(modifier = Modifier.width(4.dp))
            Box(
                modifier = Modifier.size(32.dp).noRippleClickable { showDeleteConfirm = true },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Delete, null,
                    tint = error.copy(alpha = 0.7f), modifier = Modifier.size(18.dp))
            }
        }
    }
}
