import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileText, Trash2, Loader2, CheckCircle,
  BookOpen, AlertCircle, RefreshCw, ChevronRight
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import { getSubjectsForLevel } from '@/lib/constants'
import Layout from '@/components/Layout'
import type { UploadedDocument, DocumentSection, UploadState } from '@/types'

export default function DocumentsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [subject, setSubject] = useState('')
  const [dragging, setDragging] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [pollProgress, setPollProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const subjects = profile ? getSubjectsForLevel(profile.education_level) : []

  useEffect(() => { if (profile) loadDocuments() }, [profile])

  async function loadDocuments() {
    if (!profile) return
    const { data } = await supabase
      .from('documents').select('*')
      .eq('user_id', profile.user_id)
      .order('uploaded_at', { ascending: false })
    setDocuments((data as UploadedDocument[]) || [])
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }

  async function handleUpload() {
    if (!selectedFile || !subject || !profile) return
    setUploadState({ status: 'uploading' })
    setPollProgress(0)

    const documentId = crypto.randomUUID()
    const storagePath = `documents/${profile.user_id}/${documentId}/${selectedFile.name}`

    const { error: storageErr } = await supabase.storage
      .from('documents').upload(storagePath, selectedFile)
    if (storageErr) {
      setUploadState({ status: 'error', message: storageErr.message })
      return
    }

    const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/${storagePath}`

    await supabase.from('documents').insert({
      document_id: documentId,
      user_id: profile.user_id,
      file_name: selectedFile.name,
      storage_url: storageUrl,
      mime_type: selectedFile.type || 'application/octet-stream',
      file_size_kb: Math.round(selectedFile.size / 1024),
      subject,
      education_level: profile.education_level,
      status: 'processing',
      uploaded_at: new Date().toISOString(),
    })

    // Increment user total_documents (best effort)
    try { await supabase.rpc('increment_user_documents', { uid: profile.user_id }) } catch {}

    setUploadState({ status: 'processing', documentId })

    // Trigger AI processing
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token || SUPABASE_ANON
    fetch(`${SUPABASE_URL}/functions/v1/process-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        documentId,
        storageURL: storageUrl,
        fileName: selectedFile.name,
        userId: profile.user_id,
        subject,
        extractedText: '',
      }),
    })

    // Poll every 3s up to 90s
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 3000))
      setPollProgress(Math.round(((i + 1) / 30) * 100))
      const { data: doc } = await supabase
        .from('documents').select('*')
        .eq('document_id', documentId).single()
      if (doc?.status === 'ready') {
        const { data: sections } = await supabase
          .from('document_sections').select('*')
          .eq('document_id', documentId)
          .order('section_index')
        setUploadState({
          status: 'ready',
          documentId,
          sections: (sections || []) as DocumentSection[],
        })
        await loadDocuments()
        return
      }
      if (doc?.status === 'failed') {
        setUploadState({ status: 'error', message: 'AI processing failed. Please try again.' })
        return
      }
    }
    setUploadState({ status: 'error', message: 'Processing timed out. Please try again.' })
  }

  async function confirmDelete(docId: string) {
    await supabase.from('document_sections').delete().eq('document_id', docId)
    await supabase.from('documents').delete().eq('document_id', docId)
    setDocuments(d => d.filter(x => x.document_id !== docId))
    setDeleteConfirm(null)
  }

  async function openDocument(doc: UploadedDocument) {
    if (doc.status !== 'ready') return
    const { data: sections } = await supabase
      .from('document_sections').select('*')
      .eq('document_id', doc.document_id)
      .order('section_index')
    sessionStorage.setItem('learning_doc_id', doc.document_id)
    sessionStorage.setItem('learning_sections', JSON.stringify(sections || []))
    navigate('/learn')
  }

  function startLearning(docId: string, sections: DocumentSection[]) {
    sessionStorage.setItem('learning_doc_id', docId)
    sessionStorage.setItem('learning_sections', JSON.stringify(sections))
    navigate('/learn')
  }

  function formatSize(kb: number) {
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
  }

  const isUploading = uploadState.status === 'uploading' || uploadState.status === 'processing'

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-text-white text-2xl font-bold">Upload Notes</h1>
            <p className="text-text-disabled text-sm mt-1">
              Upload your documents and TutorUG AI will create personalised learning sections for you.
            </p>
          </div>

          {/* Upload Card */}
          <div className="card space-y-4">

            {/* Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => !isUploading && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer
                ${dragging ? 'border-primary bg-primary/10 scale-[1.01]' :
                  selectedFile ? 'border-lime bg-lime/5' :
                  'border-outline hover:border-primary/60 hover:bg-primary/5'}`}>
              <input
                ref={fileRef} type="file" accept="*/*" className="hidden"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              />
              {selectedFile ? (
                <div className="space-y-2">
                  <CheckCircle size={44} className="text-lime mx-auto" />
                  <p className="text-lime font-semibold text-lg">Document selected ✓</p>
                  <p className="text-text-light text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-text-disabled text-xs">{formatSize(Math.round(selectedFile.size / 1024))}</p>
                  {!isUploading && (
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedFile(null) }}
                      className="text-text-disabled text-xs hover:text-error mt-1 underline">
                      Remove
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload size={44} className="text-primary mx-auto" />
                  <div>
                    <p className="text-text-light font-semibold">Click or drag & drop a document</p>
                    <p className="text-text-disabled text-sm mt-1">PDF · Image · DOCX · PPTX · TXT · XLSX</p>
                  </div>
                </div>
              )}
            </div>

            {/* Subject Dropdown */}
            <div>
              <label className="text-text-light text-sm font-medium mb-1.5 block">Select Subject</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="input-field"
                disabled={isUploading}>
                <option value="">Choose a subject...</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* AI Info */}
            <div className="flex items-start gap-3 bg-secondary/8 rounded-xl p-3 border border-secondary/20">
              <BookOpen size={18} className="text-secondary shrink-0 mt-0.5" />
              <p className="text-text-disabled text-sm">
                TutorUG AI will read your document and break it into <span className="text-text-light font-medium">3–5 learning sections</span> tailored to your education level and district.
              </p>
            </div>

            {/* Error */}
            {uploadState.status === 'error' && (
              <div className="flex items-center gap-3 bg-error/10 border border-error/30 rounded-xl p-3">
                <AlertCircle size={18} className="text-error shrink-0" />
                <p className="text-error text-sm">{uploadState.message}</p>
              </div>
            )}

            {/* Processing progress bar */}
            {uploadState.status === 'processing' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-text-disabled">
                  <span>AI is reading and analysing your notes...</span>
                  <span>{pollProgress}%</span>
                </div>
                <div className="h-1.5 bg-outline rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${pollProgress}%` }}
                  />
                </div>
                <p className="text-text-disabled text-xs text-center">This may take up to 30 seconds</p>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !subject || isUploading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {isUploading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {uploadState.status === 'uploading' ? 'Uploading document...' : 'AI is analysing...'}
                </>
              ) : (
                <>
                  <BookOpen size={18} />
                  Analyse with AI
                </>
              )}
            </button>
          </div>

          {/* Ready Result */}
          {uploadState.status === 'ready' && (
            <div className="card border-lime/30 bg-lime/5 animate-fade-in space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-grad-primary flex items-center justify-center text-ink font-black text-sm shrink-0">
                  AI
                </div>
                <div>
                  <p className="text-lime font-bold text-lg">Analysis Complete! 🎉</p>
                  <p className="text-text-disabled text-sm">
                    {uploadState.sections.length} learning sections created
                  </p>
                </div>
              </div>

              <div className="divide-y divide-outline/40">
                {uploadState.sections.map((s, i) => (
                  <div key={s.section_id} className="flex items-center gap-3 py-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-text-white text-sm font-medium">{s.title}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => startLearning(uploadState.documentId, uploadState.sections)}
                className="w-full bg-grad-lime text-ink font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                Start Learning <ChevronRight size={18} />
              </button>
              <button
                onClick={() => {
                  setUploadState({ status: 'idle' })
                  setSelectedFile(null)
                  setSubject('')
                  setPollProgress(0)
                }}
                className="w-full text-center text-text-disabled text-sm hover:text-text-light transition-colors py-1">
                Upload Another Document
              </button>
            </div>
          )}

          {/* Documents List */}
          {documents.length > 0 && (
            <div>
              <h2 className="text-text-disabled text-xs font-bold uppercase tracking-wider mb-3">
                Your Documents ({documents.length})
              </h2>
              <div className="space-y-3">
                {documents.map(doc => (
                  <div key={doc.document_id}>
                    {/* Delete Confirm */}
                    {deleteConfirm === doc.document_id && (
                      <div className="card border-error/30 bg-error/5 mb-2 p-4">
                        <p className="text-text-white text-sm font-medium mb-1">Delete this document?</p>
                        <p className="text-text-disabled text-xs mb-3">
                          This will permanently delete <span className="text-text-light">{doc.file_name}</span> and all its learning sections.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="btn-secondary flex-1 py-2 text-sm">
                            Cancel
                          </button>
                          <button
                            onClick={() => confirmDelete(doc.document_id)}
                            className="flex-1 bg-error text-white font-bold py-2 rounded-xl text-sm hover:bg-error/80 transition-colors">
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    <div
                      onClick={() => openDocument(doc)}
                      className={`card flex items-center gap-4 transition-all
                        ${doc.status === 'ready' ? 'cursor-pointer hover:border-primary/50 hover:bg-surface-var/50' : ''}`}>
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                        ${doc.status === 'ready' ? 'bg-primary/10' : 'bg-outline/50'}`}>
                        <FileText size={24} className={doc.status === 'ready' ? 'text-primary' : 'text-text-disabled'} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-text-white font-semibold truncate">
                          {doc.subject || doc.file_name}
                        </p>
                        <p className="text-text-disabled text-xs truncate">{doc.file_name}</p>
                        {doc.status === 'ready' && (
                          <p className="text-primary text-xs mt-0.5">
                            {doc.section_count} sections · Click to continue learning
                          </p>
                        )}
                        {doc.status === 'processing' && (
                          <p className="text-amber text-xs mt-0.5 flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin" /> Processing...
                          </p>
                        )}
                      </div>

                      {/* Status + Delete */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          doc.status === 'ready'       ? 'bg-lime/15 text-lime' :
                          doc.status === 'failed'      ? 'bg-error/15 text-error' :
                                                         'bg-amber/15 text-amber'}`}>
                          {doc.status === 'ready' ? 'Ready' : doc.status === 'failed' ? 'Failed' : 'Processing'}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteConfirm(doc.document_id) }}
                          className="p-1.5 text-error/50 hover:text-error hover:bg-error/10 rounded-lg transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {documents.length === 0 && uploadState.status === 'idle' && (
            <div className="text-center py-10 opacity-50">
              <FileText size={40} className="text-primary mx-auto mb-3" />
              <p className="text-text-white font-medium">No documents yet</p>
              <p className="text-text-disabled text-sm mt-1">Upload your first document above to get started</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
