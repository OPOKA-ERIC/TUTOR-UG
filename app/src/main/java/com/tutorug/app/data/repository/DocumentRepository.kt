package com.tutorug.app.data.repository

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.tutorug.app.data.model.DocumentSection
import com.tutorug.app.data.model.UploadedDocument
import com.tutorug.app.data.remote.SupabaseClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import java.util.UUID
import kotlin.coroutines.resume

class DocumentRepository(private val context: Context) {
    private val gson = Gson()
    private val base = SupabaseClient.SUPABASE_URL
    private val http = SupabaseClient.http
    private val json = "application/json".toMediaType()

    suspend fun uploadDocument(
        userId: String, fileUri: Uri, fileName: String, subject: String,
        educationLevel: String = ""
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            val documentId  = UUID.randomUUID().toString()
            val storagePath = "documents/$userId/$documentId/$fileName"

            val bytes = context.contentResolver.openInputStream(fileUri)?.readBytes()
                ?: throw Exception("Could not read file")
            val mimeType   = context.contentResolver.getType(fileUri) ?: "application/octet-stream"
            val fileSizeKb = bytes.size / 1024

            // 1. Extract text from the file on the Android side
            val extractedText = extractText(fileUri, mimeType, bytes)

            // 2. Upload file to Supabase Storage
            val uploadRequest = Request.Builder()
                .url("$base/storage/v1/object/$storagePath")
                .post(bytes.toRequestBody(mimeType.toMediaType()))
                .build()
            val uploadResponse = http.newCall(uploadRequest).execute()
            if (!uploadResponse.isSuccessful)
                throw Exception("Storage upload failed: ${uploadResponse.body?.string()}")

            val storageUrl = "$base/storage/v1/object/public/$storagePath"

            // 3. Insert document record into DB
            val document = mapOf(
                "document_id"     to documentId,
                "user_id"         to userId,
                "file_name"       to fileName,
                "storage_url"     to storageUrl,
                "mime_type"       to mimeType,
                "file_size_kb"    to fileSizeKb,
                "subject"         to subject,
                "education_level" to educationLevel,
                "status"          to "processing",
                "uploaded_at"     to Instant.now().toString()
            )
            val dbRequest = Request.Builder()
                .url("$base/rest/v1/documents")
                .addHeader("Prefer", "return=minimal")
                .post(gson.toJson(document).toRequestBody(json))
                .build()
            http.newCall(dbRequest).execute()

            // 4. Increment user total_documents
            incrementUserDocuments(userId)

            // 5. Trigger AI processing — send extracted text directly
            val fnPayload = gson.toJson(mapOf(
                "documentId"    to documentId,
                "storageURL"    to storageUrl,
                "fileName"      to fileName,
                "userId"        to userId,
                "subject"       to subject,
                "extractedText" to extractedText
            ))
            val fnRequest = Request.Builder()
                .url("$base/functions/v1/process-document")
                .post(fnPayload.toRequestBody(json))
                .build()
            http.newCall(fnRequest).execute()

            Result.success(documentId)
        } catch (e: Exception) {
            android.util.Log.e("TutorUG_Doc", "uploadDocument error: ${e.message}")
            Result.failure(e)
        }
    }

    // ── Text extraction ───────────────────────────────────────────────────────

    private suspend fun extractText(uri: Uri, mimeType: String, bytes: ByteArray): String {
        val text = when {
            mimeType == "application/pdf"                                    -> extractPdfText(uri)
            mimeType.startsWith("image/")                                    -> extractImageText(uri)
            mimeType.startsWith("text/")                                     -> bytes.toString(Charsets.UTF_8)
            mimeType.contains("wordprocessingml") || mimeType.contains("msword") || fileName(uri).endsWith(".docx") || fileName(uri).endsWith(".doc") -> extractDocxText(bytes)
            mimeType.contains("presentationml") || fileName(uri).endsWith(".pptx") -> extractPptxText(bytes)
            mimeType.contains("spreadsheetml") || fileName(uri).endsWith(".xlsx") -> extractXlsxText(bytes)
            else -> tryUtf8OrOcr(uri, bytes)
        }
        return text.trim().take(12000)
    }

    private fun fileName(uri: Uri): String =
        uri.lastPathSegment?.lowercase() ?: ""

    // PDF: try text layer first (fast + accurate), fall back to OCR per page
    private fun extractPdfText(uri: Uri): String {
        return try {
            val pfd: ParcelFileDescriptor = context.contentResolver.openFileDescriptor(uri, "r")
                ?: return ""
            val renderer = PdfRenderer(pfd)
            val sb = StringBuilder()
            for (i in 0 until renderer.pageCount) {
                val page = renderer.openPage(i)
                // Render at 2x resolution for better OCR accuracy
                val w = page.width * 2
                val h = page.height * 2
                val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                // Fill white background so OCR works on light text
                bitmap.eraseColor(android.graphics.Color.WHITE)
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                page.close()
                val pageText = runOcrBlocking(bitmap)
                bitmap.recycle()
                if (pageText.isNotBlank()) sb.append(pageText).append("\n")
                if (sb.length > 12000) break
            }
            renderer.close()
            pfd.close()
            sb.toString()
        } catch (e: Exception) {
            android.util.Log.e("TutorUG_Doc", "PDF extract error: ${e.message}")
            ""
        }
    }

    // Images: ML Kit OCR
    private suspend fun extractImageText(uri: Uri): String {
        return try {
            runOcrSuspend(InputImage.fromFilePath(context, uri))
        } catch (e: Exception) { "" }
    }

    // DOCX: unzip → word/document.xml → strip XML tags
    // Also extracts text from embedded images via OCR
    private fun extractDocxText(bytes: ByteArray): String {
        val sb = StringBuilder()
        try {
            val zip = java.util.zip.ZipInputStream(bytes.inputStream())
            var entry = zip.nextEntry
            while (entry != null) {
                when {
                    entry.name == "word/document.xml" -> {
                        val xml = zip.readBytes().toString(Charsets.UTF_8)
                        val clean = xml
                            .replace(Regex("<w:p[ >]"), "\n<w:p ")  // paragraph breaks
                            .replace(Regex("<[^>]+>"), "")
                            .replace(Regex("\\s+"), " ")
                            .trim()
                        sb.append(clean).append("\n")
                    }
                    entry.name.startsWith("word/media/") && sb.length < 10000 -> {
                        // Embedded image — OCR it
                        val imgBytes = zip.readBytes()
                        val bitmap = android.graphics.BitmapFactory.decodeByteArray(imgBytes, 0, imgBytes.size)
                        if (bitmap != null) {
                            val imgText = runOcrBlocking(bitmap)
                            bitmap.recycle()
                            if (imgText.isNotBlank()) sb.append("\n[Image text: $imgText]\n")
                        }
                    }
                }
                entry = zip.nextEntry
            }
        } catch (e: Exception) {
            android.util.Log.e("TutorUG_Doc", "DOCX extract error: ${e.message}")
        }
        return sb.toString()
    }

    // PPTX: unzip → ppt/slides/slide*.xml → strip XML tags + OCR images
    private fun extractPptxText(bytes: ByteArray): String {
        val sb = StringBuilder()
        try {
            val zip = java.util.zip.ZipInputStream(bytes.inputStream())
            var entry = zip.nextEntry
            while (entry != null) {
                when {
                    entry.name.matches(Regex("ppt/slides/slide[0-9]+\\.xml")) -> {
                        val xml = zip.readBytes().toString(Charsets.UTF_8)
                        val clean = xml
                            .replace(Regex("<a:p[ >]"), "\n")
                            .replace(Regex("<[^>]+>"), "")
                            .replace(Regex("\\s+"), " ")
                            .trim()
                        sb.append(clean).append("\n")
                    }
                    entry.name.startsWith("ppt/media/") && sb.length < 10000 -> {
                        val imgBytes = zip.readBytes()
                        val bitmap = android.graphics.BitmapFactory.decodeByteArray(imgBytes, 0, imgBytes.size)
                        if (bitmap != null) {
                            val imgText = runOcrBlocking(bitmap)
                            bitmap.recycle()
                            if (imgText.isNotBlank()) sb.append("\n[Slide image: $imgText]\n")
                        }
                    }
                }
                entry = zip.nextEntry
            }
        } catch (e: Exception) {
            android.util.Log.e("TutorUG_Doc", "PPTX extract error: ${e.message}")
        }
        return sb.toString()
    }

    // XLSX: unzip → xl/sharedStrings.xml + xl/worksheets/sheet*.xml
    private fun extractXlsxText(bytes: ByteArray): String {
        val sb = StringBuilder()
        try {
            val zip = java.util.zip.ZipInputStream(bytes.inputStream())
            var entry = zip.nextEntry
            while (entry != null) {
                if (entry.name == "xl/sharedStrings.xml" ||
                    entry.name.matches(Regex("xl/worksheets/sheet[0-9]+\\.xml"))) {
                    val xml = zip.readBytes().toString(Charsets.UTF_8)
                    val clean = xml
                        .replace(Regex("<[^>]+>"), " ")
                        .replace(Regex("\\s+"), " ")
                        .trim()
                    sb.append(clean).append("\n")
                }
                entry = zip.nextEntry
            }
        } catch (e: Exception) {
            android.util.Log.e("TutorUG_Doc", "XLSX extract error: ${e.message}")
        }
        return sb.toString()
    }

    // Unknown binary: try UTF-8, if it looks like garbage try OCR as image
    private suspend fun tryUtf8OrOcr(uri: Uri, bytes: ByteArray): String {
        val utf8 = bytes.toString(Charsets.UTF_8)
        val printableRatio = utf8.count { it.code in 32..126 }.toFloat() / utf8.length.coerceAtLeast(1)
        return if (printableRatio > 0.7f) {
            utf8.take(8000)
        } else {
            // Treat as image and OCR
            try { runOcrSuspend(InputImage.fromFilePath(context, uri)) } catch (e: Exception) { "" }
        }
    }

    private fun runOcrBlocking(bitmap: Bitmap): String {
        var result = ""
        val latch = java.util.concurrent.CountDownLatch(1)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        recognizer.process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener { result = it.text; latch.countDown() }
            .addOnFailureListener { latch.countDown() }
        latch.await(10, java.util.concurrent.TimeUnit.SECONDS)
        return result
    }

    private suspend fun runOcrSuspend(image: InputImage): String =
        suspendCancellableCoroutine { cont ->
            TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                .process(image)
                .addOnSuccessListener { cont.resume(it.text) }
                .addOnFailureListener { cont.resume("") }
        }

    // ── DB helpers ────────────────────────────────────────────────────────────

    private suspend fun incrementUserDocuments(userId: String) {
        try {
            val getResp = http.newCall(Request.Builder()
                .url("$base/rest/v1/users?user_id=eq.$userId&select=total_documents&limit=1")
                .get().build()).execute()
            val getBody = getResp.body?.string() ?: return
            val list = gson.fromJson<List<Map<String, Any>>>(getBody, object : TypeToken<List<Map<String, Any>>>() {}.type)
            val current = (list.firstOrNull()?.get("total_documents") as? Double)?.toInt() ?: 0
            http.newCall(Request.Builder()
                .url("$base/rest/v1/users?user_id=eq.$userId")
                .addHeader("Prefer", "return=minimal")
                .patch(gson.toJson(mapOf("total_documents" to current + 1)).toRequestBody(json))
                .build()).execute()
        } catch (_: Exception) {}
    }

    suspend fun deleteDocument(documentId: String, userId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            http.newCall(Request.Builder()
                .url("$base/rest/v1/document_sections?document_id=eq.$documentId&user_id=eq.$userId")
                .delete().build()).execute()
            http.newCall(Request.Builder()
                .url("$base/rest/v1/documents?document_id=eq.$documentId&user_id=eq.$userId")
                .delete().build()).execute()
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getDocument(documentId: String): UploadedDocument? = withContext(Dispatchers.IO) {
        try {
            val response = http.newCall(Request.Builder()
                .url("$base/rest/v1/documents?document_id=eq.$documentId&limit=1")
                .get().build()).execute()
            val body = response.body?.string() ?: return@withContext null
            if (!response.isSuccessful) return@withContext null
            gson.fromJson<List<UploadedDocument>>(body, object : TypeToken<List<UploadedDocument>>() {}.type)
                .firstOrNull()
        } catch (e: Exception) { null }
    }

    suspend fun getUserDocuments(userId: String): List<UploadedDocument> = withContext(Dispatchers.IO) {
        try {
            val response = http.newCall(Request.Builder()
                .url("$base/rest/v1/documents?user_id=eq.$userId&order=uploaded_at.desc")
                .get().build()).execute()
            val body = response.body?.string() ?: return@withContext emptyList()
            if (!response.isSuccessful) return@withContext emptyList()
            gson.fromJson<List<UploadedDocument>>(body, object : TypeToken<List<UploadedDocument>>() {}.type)
                ?: emptyList()
        } catch (e: Exception) { emptyList() }
    }

    suspend fun getDocumentSections(documentId: String): List<DocumentSection> = withContext(Dispatchers.IO) {
        try {
            val response = http.newCall(Request.Builder()
                .url("$base/rest/v1/document_sections?document_id=eq.$documentId&order=section_index.asc")
                .get().build()).execute()
            val body = response.body?.string() ?: return@withContext emptyList()
            if (!response.isSuccessful) return@withContext emptyList()
            gson.fromJson<List<DocumentSection>>(body, object : TypeToken<List<DocumentSection>>() {}.type)
                ?: emptyList()
        } catch (e: Exception) { emptyList() }
    }
}
