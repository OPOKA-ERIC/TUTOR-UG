import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare, Pencil, Search, Trash2, X } from 'lucide-react'
import type { ChatSession } from '@/types'

function clip(t: string, n: number): string {
  const c = t.replace(/\s+/g, ' ').trim()
  return c.length > n ? `${c.slice(0, n).trimEnd()}…` : c
}

function groupKey(iso?: string): string {
  if (!iso) return 'Older'
  const d = new Date(iso)
  const now = new Date()
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((start(now) - start(d)) / 86400000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTimestamp(iso?: string): string {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const GREETING = /^(hi+|hii+|hey+|heyy+|hello+|yo+|hiya|howdy|hello there|good\s+(morning|afternoon|evening|day))\s*[!.?,]*$/i

export function titleFor(s: ChatSession): string {
  const title = (s.title || '').trim()
  if (title && !/^(general|new chat|chat)$/i.test(title) && title !== (s.subject || '').trim()) return clip(title, 60)

  const raw = (s.first_message || '').trim()
  if (raw) {
    const cleaned = raw.replace(/\s+/g, ' ').trim()
    if (!GREETING.test(cleaned)) return clip(cleaned, 40)
    return 'New conversation'
  }

  const subject = (s.subject || '').trim()
  if (subject && !/^general$/i.test(subject)) return subject
  return 'New conversation'
}

function renameInitial(s: ChatSession): string {
  const title = (s.title || '').trim()
  if (title && !/^(general|new chat|chat)$/i.test(title) && title !== (s.subject || '').trim()) return title
  return (s.first_message || '').replace(/\s+/g, ' ').trim()
}

const TIMESTAMP_COLOR = '#9A9AC4'

interface ChatHistoryModalProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  historyLoading: boolean
  onSelect: (s: ChatSession) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onClose: () => void
}

export default function ChatHistoryModal(props: ChatHistoryModalProps) {
  const { sessions, currentSessionId, historyLoading, onSelect, onDelete, onRename, onClose } = props
  const [query, setQuery] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    searchRef.current?.focus()
    return () => { prev?.focus?.() }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter(el => el.offsetParent !== null || el === document.activeElement)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return sessions
    return sessions.filter(s => {
      const hay = `${titleFor(s)} ${s.subject || ''} ${s.first_message || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [sessions, q])

  const groups = useMemo(() => {
    const g: Record<string, ChatSession[]> = {}
    for (const s of filtered) {
      const k = groupKey(s.last_message_at)
      ;(g[k] = g[k] || []).push(s)
    }
    return g
  }, [filtered])

  function startRename(s: ChatSession) {
    setRenameId(s.session_id)
    setRenameValue(renameInitial(s))
  }

  function commitRename() {
    if (renameId && renameValue.trim()) onRename(renameId, renameValue)
    setRenameId(null)
    setRenameValue('')
  }

  const confirmTarget = confirmId ? sessions.find(s => s.session_id === confirmId) : null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Chat History"
        className="relative w-full h-full sm:w-[560px] sm:max-w-[92vw] sm:h-auto sm:max-h-[min(85vh,760px)] bg-surface sm:border sm:border-outline sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none">
        <div className="shrink-0 px-4 pt-4 pb-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-text-white font-bold text-lg flex-1">Chat History</h2>
            <button onClick={onClose} title="Close" aria-label="Close chat history"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 hover:text-primary transition-colors">
              <X size={18} className="text-text-disabled" />
            </button>
          </div>
          <div className="flex items-center gap-2.5 px-3 h-11 rounded-xl bg-surface-input border border-outline focus-within:border-primary transition-colors">
            <Search size={16} className="text-text-disabled shrink-0" />
            <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search chats…"
              className="flex-1 bg-transparent outline-none text-sm text-text-white placeholder-text-disabled" />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
          {historyLoading ? (
            <div className="px-2.5 space-y-1">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 animate-pulse">
                  <div className="w-8 h-8 rounded-lg shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <div className="flex-1 py-0.5">
                    <div className="h-3.5 rounded w-2/3" style={{ background: 'rgba(255,255,255,0.1)' }} />
                    <div className="h-2.5 rounded w-1/3 mt-1.5" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center px-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Search size={22} className="text-text-disabled" />
              </div>
              <p className="text-sm" style={{ color: '#A3A3C8' }}>
                {q ? (sessions.length === 0 ? 'No conversations yet.' : 'No chats match your search.') : 'No conversations yet.'}
              </p>
              {q && sessions.length > 0 && (
                <p className="text-xs" style={{ color: '#9A9AC4' }}>Try a different word, or clear the search box.</p>
              )}
            </div>
          ) : (
            Object.entries(groups).map(([label, list]) => (
              <div key={label} className="mb-4">
                <p className="text-xs font-bold px-2 mb-1.5" style={{ color: TIMESTAMP_COLOR }}>{label}</p>
                <div>
                  {list.map(s => {
                    const active = s.session_id === currentSessionId
                    const renaming = renameId === s.session_id
                    return (
                      <div key={s.session_id}
                        onClick={() => { if (!renaming) onSelect(s) }}
                        className="group flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-colors hover:bg-surface-var"
                        style={{ backgroundColor: active ? 'rgba(255,184,0,0.12)' : 'transparent' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: active ? 'rgba(255,184,0,0.18)' : 'rgba(255,255,255,0.06)' }}>
                          <MessageSquare size={15} style={{ color: active ? '#FFB800' : '#8A8AB0' }} />
                        </div>
                        <div className="flex-1 min-w-0" onClick={e => { if (renaming) e.stopPropagation() }}>
                          {renaming ? (
                            <input value={renameValue} autoFocus
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                e.stopPropagation()
                                if (e.key === 'Enter') commitRename()
                                if (e.key === 'Escape') { setRenameId(null); setRenameValue('') }
                              }}
                              onBlur={commitRename}
                              className="w-full bg-surface-input border border-primary rounded-md px-2 py-1 text-sm text-text-white outline-none" />
                          ) : (
                            <>
                              <p className="text-sm font-semibold truncate" style={{ color: active ? '#FFD65C' : '#D8D8EE' }}>{titleFor(s)}</p>
                              <p className="text-xs truncate mt-0.5" style={{ color: TIMESTAMP_COLOR }}>
                                {s.subject && !/^general$/i.test(s.subject) ? `${s.subject} · ` : ''}{formatTimestamp(s.last_message_at)}
                              </p>
                            </>
                          )}
                        </div>
                        {!renaming && (
                          <>
                            <button onClick={e => { e.stopPropagation(); startRename(s) }}
                              title="Rename" aria-label="Rename chat"
                              className="p-2 rounded-lg hover:bg-white/10 transition-opacity opacity-0 group-hover:opacity-100 max-md:opacity-100">
                              <Pencil size={14} className="text-text-disabled" />
                            </button>
                            <button onClick={e => { e.stopPropagation(); setConfirmId(s.session_id) }}
                              title="Delete" aria-label="Delete chat"
                              className="p-2 rounded-lg hover:bg-white/10 transition-opacity opacity-0 group-hover:opacity-100 max-md:opacity-100">
                              <Trash2 size={14} className="text-error" />
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {confirmTarget && (
          <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center p-6"
            onClick={() => setConfirmId(null)}>
            <div className="bg-surface-var rounded-2xl p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
              <p className="text-text-white font-bold mb-1">Delete Chat?</p>
              <p className="text-text-disabled text-sm mb-4">“{titleFor(confirmTarget)}” and all its messages will be permanently deleted.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmId(null)} className="flex-1 btn-secondary py-2 text-sm">Cancel</button>
                <button onClick={() => { onDelete(confirmTarget.session_id); setConfirmId(null) }}
                  className="flex-1 bg-error text-white font-bold py-2 rounded-xl text-sm">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}