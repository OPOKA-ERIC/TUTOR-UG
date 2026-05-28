import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CloudUpload, CheckCircle, Sparkles,
  BookOpen, FileText, Trash2, Loader2, MessageSquare
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import { getSubjectsForLevel } from '@/lib/constants'
import Logo from '@/components/Logo'
import type { UploadedDocument, DocumentSection, UploadState } from '@/types'

export default function DocumentsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [subject, setSubject] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
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

  async function handleUpload() {
    if (!selectedFile || !subject || !profile) return
    setUploadState({ status: 'uploading' })

    const documentId = crypto.randomUUID()
    const storagePath = `documents/${profile.user_id}/${documentId}/${selectedFile.name}`

    const { error: storageErr } = await supabase.storage.from('documents').upload(storagePath, selectedFile)
    if (storageErr) { setUploadState({ status: 'error', message: storageErr.message }); return }

    const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/${storagePath}`

    await supabase.from('documents').insert({
      document_id: documentId, user_id: profile.user_id,
      file_name: selectedFile.name, storage_url: storageUrl,
      mime_type: selectedFile.type || 'application/octet-stream',
      file_size_kb: Math.round(selectedFile.size / 1024),
      subject, education_level: profile.education_level,
      status: 'processing', uploaded_at: new Date().toISOString(),
    })

    setUploadState({ status: 'processing', documentId })

    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token || SUPABASE_ANON
    fetch(`${SUPABASE_URL}/functions/v1/process-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ documentId, storageURL: storageUrl, fileName: selectedFile.name, userId: profile.user_id, subject, extractedText: '' }),
    })

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const { data: doc } = await supabase.from('documents').select('*').eq('document_id', documentId).single()
      if (doc?.status === 'ready') {
        const { data: sections } = await supabase.from('document_sections').select('*').eq('document_id', documentId).order('section_index')
        setUploadState({ status: 'ready', documentId, sections: (sections || []) as DocumentSection[] })
        await loadDocuments()
        return
      }
      if (doc?.status === 'failed') { setUploadState({ status: 'error', message: 'AI processing failed. Please try again.' }); return }
    }
    setUploadState({ status: 'error', message: 'Processing timed out. Please try again.' })
  }

  async function deleteDocument(docId: string) {
    await supabase.from('document_sections').delete().eq('document_id', docId)
    await supabase.from('documents').delete().eq('document_id', docId)
    setDocuments(d => d.filter(x => x.document_id !== docId))
    setDeleteConfirmId(null)
  }

  async function openDocument(doc: UploadedDocument) {
    if (doc.status !== 'ready') return
    const { data: sections } = await supabase.from('document_sections').select('*').eq('document_id', doc.document_id).order('section_index')
    sessionStorage.setItem('learning_doc_id', doc.document_id)
    sessionStorage.setItem('learning_sections', JSON.stringify(sections || []))
    navigate('/learn')
  }

  function startLearning(docId: string, sections: DocumentSection[]) {
    sessionStorage.setItem('learning_doc_id', docId)
    sessionStorage.setItem('learning_sections', JSON.stringify(sections))
    navigate('/learn')
  }

  const isUploading = uploadState.status === 'uploading' || uploadState.status === 'processing'
  const fileSelected = selectedFile !== null
  const canUpload = !isUploading && fileSelected && subject !== ''

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface to-bg relative overflow-hidden">

      {/* Radial glow top-right — matches Android */}
      <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.1), transparent)' }} />

      {/* ── TOP BAR — matches Android gradient bar ── */}
      <div className="bg-gradient-to-r from-surface to-surface-var px-2 py-2 flex items-center gap-1 shrink-0">
        <button onClick={() => navigate('/documents')}
          className="w-12 h-12 flex items-center justify-center shrink-0">
          <div className="w-9 h-9 bg-surface-input rounded-full flex items-center justify-center">
            <ArrowLeft size={18} className="text-text-white" />
          </div>
        </button>
        <Logo size="sm" />
        <span className="text-text-white text-xl font-bold ml-2">Upload Notes</span>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* ── DROP ZONE — matches Android border gradient ── */}
        <div
          onClick={() => !isUploading && fileRef.current?.click()}
          className="w-full h-44 rounded-2xl bg-surface flex items-center justify-center cursor-pointer transition-all relative overflow-hidden"
          style={{
            border: '2px solid transparent',
            backgroundClip: 'padding-box',
            boxShadow: fileSelected
              ? '0 0 0 2px #84CC16'
              : '0 0 0 2px transparent',
            outline: fileSelected ? 'none' : '2px solid',
            outlineColor: fileSelected ? 'transparent' : 'rgba(255,184,0,0.5)',
          }}>
          <input ref={fileRef} type="file" accept="*/*" className="hidden"
            onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            {fileSelected ? (
              <>
                <CheckCircle size={56} className="text-lime" />
                <p className="text-lime font-medium text-base">Document selected ✓</p>
                <p className="text-text-disabled text-xs mt-1">{selectedFile!.name}</p>
              </>
            ) : (
              <>
                <CloudUpload size={56} className="text-primary" />
                <p className="text-text-disabled font-medium text-base">Tap to select document</p>
                <p className="text-text-disabled text-xs mt-1">PDF • Image • DOCX • PPTX • TXT</p>
              </>
            )}
          </div>
        </div>

        {/* ── SUBJECT DROPDOWN ── */}
        <div className="relative">
          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
            disabled={isUploading}
            className="input-field appearance-none">
            <option value="">Select Subject</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* ── AI INFO HINT — matches Android secondary/8 surface ── */}
        <div className="w-full rounded-xl flex items-center gap-3 px-4 py-3.5"
          style={{ backgroundColor: 'rgba(124,58,237,0.08)' }}>
          <Sparkles size={20} className="text-secondary shrink-0" />
          <p className="text-text-disabled text-sm">
            TutorUG AI will scan your notes and create personalised learning units.
          </p>
        </div>

        {/* ── ERROR ── */}
        {uploadState.status === 'error' && (
          <div className="rounded-xl px-3 py-3" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
            <p className="text-error text-sm">{uploadState.message}</p>
          </div>
        )}

        {/* ── UPLOAD BUTTON — Amber gradient matches Android Amber400→Amber600 ── */}
        <button
          onClick={handleUpload}
          disabled={!canUpload}
          className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-bold text-base transition-all"
          style={{
            background: canUpload
              ? 'linear-gradient(135deg, #F59E0B, #D97706)'
              : 'linear-gradient(135deg, #252545, #252545)',
            color: canUpload ? '#0A0A1F' : '#606080',
          }}>
          {isUploading
            ? <Loader2 size={22} className="animate-spin" />
            : <><Sparkles size={20} /> Analyse with AI</>}
        </button>

        {/* ── YOUR DOCUMENTS ── */}
        {documents.length > 0 && (
          <div>
            <p className="text-text-disabled text-xs font-bold uppercase tracking-wider px-0.5 mb-2.5">
              YOUR DOCUMENTS
            </p>
            <div className="space-y-2">
              {documents.map(doc => {
                const isReady = doc.status === 'ready'
                const statusColor = doc.status === 'ready' ? '#84CC16' : doc.status === 'failed' ? '#F87171' : '#F59E0B'
                const statusLabel = doc.status === 'ready' ? 'Ready' : doc.status === 'failed' ? 'Failed' : 'Processing…'

                return (
                  <div key={doc.document_id}>
                    {/* Delete confirm modal */}
                    {deleteConfirmId === doc.document_id && (
                      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
                        <div className="bg-surface-card rounded-2xl p-6 w-full max-w-sm">
                          <p className="text-text-white font-bold text-base mb-2">Delete Document?</p>
                          <p className="text-text-disabled text-sm mb-5">
                            This will permanently delete this document and all its learning sections.
                          </p>
                          <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirmId(null)}
                              className="flex-1 btn-secondary py-2 text-sm">Cancel</button>
                            <button onClick={() => deleteDocument(doc.document_id)}
                              className="flex-1 bg-error text-white font-bold py-2 rounded-xl text-sm">Delete</button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div
                      onClick={() => isReady && openDocument(doc)}
                      className={`bg-surface rounded-xl flex items-center gap-3 px-3.5 py-3.5 transition-all
                        ${isReady ? 'cursor-pointer border border-primary/30 hover:border-primary/60' : ''}`}>
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'rgba(255,184,0,0.12)' }}>
                        {isReady
                          ? <BookOpen size={22} className="text-primary" />
                          : <FileText size={22} className="text-text-disabled" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-text-white font-medium text-sm truncate">
                          {doc.subject || doc.file_name}
                        </p>
                        <p className="text-text-disabled text-xs truncate">{doc.file_name}</p>
                        {isReady && (
                          <p className="text-primary text-xs mt-0.5">
                            {doc.section_count} sections • Tap to continue learning
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold px-2 py-1 rounded-full"
                          style={{ backgroundColor: `${statusColor}26`, color: statusColor }}>
                          {statusLabel}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteConfirmId(doc.document_id) }}
                          className="w-8 h-8 flex items-center justify-center">
                          <Trash2 size={18} style={{ color: 'rgba(239,68,68,0.7)' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* ── LOADING OVERLAY — matches Android black/60 overlay ── */}
      {isUploading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40">
          <div className="bg-surface rounded-2xl px-8 py-8 flex flex-col items-center gap-4 mx-6">
            <Loader2 size={36} className="animate-spin text-primary" />
            <p className="text-text-light text-sm text-center">
              {uploadState.status === 'uploading'
                ? 'Uploading your document...'
                : 'AI is reading and analysing your notes...'}
            </p>
            {uploadState.status === 'processing' && (
              <p className="text-text-disabled text-xs">This may take up to 30 seconds</p>
            )}
          </div>
        </div>
      )}

      {/* ── AI RESULTS OVERLAY — matches Android black/85 overlay ── */}
      {uploadState.status === 'ready' && (
        <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-40 p-6">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A0A1F' }}>
                AI
              </div>
              <div>
                <p className="text-lime font-bold text-base">Analysis Complete!</p>
                <p className="text-text-disabled text-xs">
                  {uploadState.sections.length} learning sections created
                </p>
              </div>
            </div>

            <div className="h-px bg-white/8 mb-3" />

            <div className="space-y-1 mb-5">
              {uploadState.sections.map((s, i) => (
                <div key={s.section_id} className="flex items-center gap-3 py-1.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-primary text-xs font-bold shrink-0"
                    style={{ backgroundColor: 'rgba(255,184,0,0.15)' }}>
                    {i + 1}
                  </div>
                  <span className="text-text-white text-sm font-medium">{s.title}</span>
                </div>
              ))}
            </div>

            {/* Start Learning — Amber gradient */}
            <button
              onClick={() => startLearning(uploadState.documentId, uploadState.sections)}
              className="w-full h-12 rounded-2xl font-bold text-base mb-2"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A0A1F' }}>
              Start Learning
            </button>

            <button
              onClick={() => { setUploadState({ status: 'idle' }); setSelectedFile(null); setSubject('') }}
              className="w-full text-center text-text-disabled text-sm py-1 hover:text-text-light transition-colors">
              Upload Another Document
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
