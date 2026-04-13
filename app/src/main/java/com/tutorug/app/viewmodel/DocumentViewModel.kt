package com.tutorug.app.viewmodel

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tutorug.app.data.model.UploadedDocument
import com.tutorug.app.data.repository.DocumentRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class DocumentViewModel(application: Application) : AndroidViewModel(application) {

    private val documentRepository = DocumentRepository(application)

    private val _uploadState = MutableStateFlow<UploadState>(UploadState.Idle)
    val uploadState: StateFlow<UploadState> = _uploadState

    private val _documents = MutableStateFlow<List<UploadedDocument>>(emptyList())
    val documents: StateFlow<List<UploadedDocument>> = _documents

    fun uploadDocument(userId: String, fileUri: Uri, fileName: String, subject: String, educationLevel: String = "") {
        viewModelScope.launch {
            _uploadState.value = UploadState.Uploading
            val result = documentRepository.uploadDocument(userId, fileUri, fileName, subject, educationLevel)
            if (result.isSuccess) {
                val documentId = result.getOrNull()!!
                _uploadState.value = UploadState.Processing(documentId)
                // Poll until document is ready or failed
                pollDocumentStatus(documentId)
            } else {
                _uploadState.value = UploadState.Error(result.exceptionOrNull()?.message ?: "Upload failed")
            }
        }
    }

    private suspend fun pollDocumentStatus(documentId: String) {
        repeat(30) { attempt ->
            kotlinx.coroutines.delay(3000) // check every 3 seconds
            val doc = documentRepository.getDocument(documentId)
            when (doc?.status) {
                "ready" -> {
                    val sections = documentRepository.getDocumentSections(documentId)
                    _uploadState.value = UploadState.Ready(documentId, sections)
                    return
                }
                "failed" -> {
                    _uploadState.value = UploadState.Error("AI processing failed. Please try again.")
                    return
                }
            }
        }
        _uploadState.value = UploadState.Error("Processing timed out. Please try again.")
    }

    fun deleteDocument(documentId: String, userId: String) {
        viewModelScope.launch {
            documentRepository.deleteDocument(documentId, userId)
            _documents.value = _documents.value.filter { it.documentId != documentId }
        }
    }

    suspend fun loadDocumentSections(documentId: String) =
        documentRepository.getDocumentSections(documentId)

    fun loadUserDocuments(userId: String) {
        viewModelScope.launch {
            _documents.value = documentRepository.getUserDocuments(userId)
        }
    }

    fun getDocument(documentId: String) {
        viewModelScope.launch {
            val doc = documentRepository.getDocument(documentId)
            if (doc != null) {
                val current = _documents.value.toMutableList()
                val index = current.indexOfFirst { it.documentId == documentId }
                if (index >= 0) current[index] = doc else current.add(0, doc)
                _documents.value = current
            }
        }
    }

    fun resetUploadState() {
        _uploadState.value = UploadState.Idle
    }
}

sealed class UploadState {
    object Idle : UploadState()
    object Uploading : UploadState()
    data class Processing(val documentId: String) : UploadState()
    data class Ready(val documentId: String, val sections: List<com.tutorug.app.data.model.DocumentSection>) : UploadState()
    data class Error(val message: String) : UploadState()
}
