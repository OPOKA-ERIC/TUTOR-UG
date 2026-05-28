import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Trash2, Loader2, CheckCircle, XCircle, Clock, BookOpen } from 'lucide-react'
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
  const fileRef = useRef<HTMLInputElement>(null)
  const subjects = profile ? getSubjectsForLevel(profile.education_level) : []

  useEffect(() => { if (profile) loadDocuments() }, [profile])

  async function loadDocuments() {
    if (!profile) return
    const { data } = await supabase.from('documents').select('*').eq('user_id', profile.user_id).order('uploaded_at', { ascending: false })
    setDocuments((data as UploadedDocument[]) || [])
  }

  async function handleUpload() {
    if (!selectedFile || !subject || !profile) return
    setUploadState({ status: 'uploading' })

    const documentId = crypto.randomUUID()
    const storagePath = `documents/${profile.user_id}/${documentId}/${selectedFile.name}`

    // Upload to Supabase Storage
    const { error: storageErr } = await supabase.storage.from('documents').upload(storagePath, selectedFile)
    if (storageErr) { setUploadState({ status: 'error', message: storageErr.message }); return }

    const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/${storagePath}`

    // Insert document record
    await supabase.from('documents').insert({
      document_id: documentId, user_id: profile.user_id,
      file_name: selectedFile.name, storage_url: storageUrl,
      mime_type: selectedFile.type, file_size_kb: Math.round(selectedFile.size / 1024),
      subject, education_level: profile.education_level,
      status: 'processing', uploaded_at: new Date().toISOString(),
    })

    setUploadState({ status: 'processing', documentId })

    // Call process-document Edge Function
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token || SUPABASE_ANON
    fetch(`${SUPABASE_URL}/functions/v1/process-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ documentId, storageURL: storageUrl, fileName: selectedFile.name, userId: profile.user_id, subject, extractedText: '' }),
    })

    // Poll for completion
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
  }

  function startLearning(docId: string, sections: DocumentSection[]) {
    sessionStorage.setItem('learning_doc_id', docId)
    sessionStorage.setItem('learning_sections', JSON.stringify(sections))
    navigate('/learn')
  }

  async function openDocument(doc: UploadedDocument) {
    if (doc.status !== 'ready') return
    const { data: sections } = await supabase.from('document_sections').select('*').eq('document_id', doc.document_id).order('section_index')
    startLearning(doc.document_id, (sections || []) as DocumentSection[])
  }

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        <h1 className="text-text-white text-2xl font-bold mb-6">Upload Notes</h1>

        {/* Upload card */}
        <div className="card mb-6">
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-4
              ${selectedFile ? 'border-lime bg-lime/5' : 'border-outline hover:border-primary hover:bg-primary/5'}`}>
            <input ref={fileRef} type="file" accept="*/*" className="hidden"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
            {selectedFile ? (
              <>
                <CheckCircle size={40} className="text-lime mx-auto mb-3" />
                <p className="text-lime font-medium">Document selected ✓</p>
                <p className="text-text-disabled text-sm mt-1">{selectedFile.name}</p>
              </>
            ) : (
              <>
                <Upload size={40} className="text-primary mx-auto mb-3" />
                <p className="text-text-light font-medium">Click to select a document</p>
                <p className="text-text-disabled text-sm mt-1">PDF • Image • DOCX • PPTX • TXT</p>
              </>
            )}
          </div>

          {/* Subject */}
          <select value={subject} onChange={e => setSubject(e.target.value)} className="input-field mb-4">
            <option value="">Select Subject</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Info */}
          <div className="bg-secondary/10 rounded-xl p-3 flex items-center gap-3 mb-4">
            <BookOpen size={18} className="text-secondary shrink-0" />
            <p className="text-text-disabled text-sm">TutorUG AI will scan your notes and create personalised learning units.</p>
          </div>

          {uploadState.status === 'error' && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-4 text-error text-sm">{uploadState.message}</div>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || !subject || uploadState.status === 'uploading' || uploadState.status === 'processing'}
            className="btn-primary w-full flex items-center justify-center gap-2">
            {(uploadState.status === 'uploading' || uploadState.status === 'processing')
              ? <><Loader2 size={18} className="animate-spin" /> {uploadState.status === 'uploading' ? 'Uploading...' : 'AI is analysing...'}</>
              : <><BookOpen size={18} /> Analyse with AI</>}
          </button>
        </div>

        {/* Ready overlay */}
        {uploadState.status === 'ready' && (
          <div className="card border-lime/30 bg-lime/5 mb-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-grad-primary flex items-center justify-center text-ink font-black text-sm">AI</div>
              <div>
                <p className="text-lime font-bold">Analysis Complete!</p>
                <p className="text-text-disabled text-sm">{uploadState.sections.length} learning sections created</p>
              </div>
            </div>
            {uploadState.sections.map((s, i) => (
              <div key={s.section_id} className="flex items-center gap-3 py-2 border-t border-outline/50">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold">{i+1}</div>
                <span className="text-text-white text-sm">{s.title}</span>
              </div>
            ))}
            <button onClick={() => startLearning(uploadState.documentId, uploadState.sections)}
              className="btn-primary w-full mt-4">Start Learning →</button>
            <button onClick={() => { setUploadState({ status: 'idle' }); setSelectedFile(null); setSubject('') }}
              className="w-full text-center text-text-disabled text-sm mt-2 hover:text-text-light">Upload Another</button>
          </div>
        )}

        {/* Documents list */}
        {documents.length > 0 && (
          <div>
            <h2 className="text-text-disabled text-xs font-bold uppercase mb-3">Your Documents</h2>
            <div className="space-y-3">
              {documents.map(doc => (
                <div key={doc.document_id}
                  onClick={() => openDocument(doc)}
                  className={`card flex items-center gap-4 transition-colors ${doc.status === 'ready' ? 'cursor-pointer hover:border-primary/40' : ''}`}>
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText size={22} className={doc.status === 'ready' ? 'text-primary' : 'text-text-disabled'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-white font-medium truncate">{doc.subject || doc.file_name}</p>
                    <p className="text-text-disabled text-xs truncate">{doc.file_name}</p>
                    {doc.status === 'ready' && <p className="text-primary text-xs">{doc.section_count} sections · Tap to continue</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      doc.status === 'ready' ? 'bg-lime/15 text-lime' :
                      doc.status === 'failed' ? 'bg-error/15 text-error' : 'bg-amber/15 text-amber'}`}>
                      {doc.status === 'ready' ? 'Ready' : doc.status === 'failed' ? 'Failed' : 'Processing…'}
                    </span>
                    <button onClick={e => { e.stopPropagation(); deleteDocument(doc.document_id) }}
                      className="text-error/60 hover:text-error p-1 rounded transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
