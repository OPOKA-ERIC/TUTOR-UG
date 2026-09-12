import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Atom, BookOpen, BookText, Calculator, Calendar, ChevronDown, Church,
  Cpu, Dna, Dumbbell, FileText, FlaskConical, Globe, Landmark, Languages,
  Leaf, LogOut, MessageSquare, Microscope, Moon, Music, Palette, PanelLeftClose,
  Plus, Ruler, Search, Settings, ShoppingBag, Sparkles, TrendingUp, Users, UsersRound,
  Video, Mic, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UserProfile } from '@/types'

interface NavDef { path: string; label: string; icon: LucideIcon; accent: string }

const NAV: NavDef[] = [
  { path: '/meetings', label: 'Meetings', icon: Video, accent: '#F59E0B' },
  { path: '/rooms', label: 'Study Rooms', icon: Users, accent: '#A78BFA' },
  { path: '/podcast', label: 'AI Podcast', icon: Mic, accent: '#F87171' },
]

const SUBJECT_META: Record<string, [LucideIcon, string]> = {
  'mathematics': [Calculator, '#3B82F6'], 'maths': [Calculator, '#3B82F6'],
  'physics': [Atom, '#0EA5E9'],
  'chemistry': [FlaskConical, '#A855F7'],
  'biology': [Dna, '#22C55E'],
  'science': [Microscope, '#06B6D4'],
  'english': [BookOpen, '#F43F5E'], 'english language': [BookOpen, '#F43F5E'],
  'literature': [BookText, '#F43F5E'], 'literature in english': [BookText, '#F43F5E'],
  'geography': [Globe, '#14B8A6'],
  'history': [Landmark, '#F97316'],
  'social studies': [UsersRound, '#EAB308'],
  'religious education': [Church, '#8B5CF6'], 'cre': [Church, '#8B5CF6'],
  'ire': [Moon, '#A78BFA'], 'divinity': [Sparkles, '#C084FC'],
  'fine art': [Palette, '#EC4899'], 'art': [Palette, '#EC4899'],
  'music': [Music, '#84CC16'],
  'physical education': [Dumbbell, '#F59E0B'],
  'computer studies': [Cpu, '#10B981'], 'subsidiary ict': [Cpu, '#10B981'], 'ict': [Cpu, '#10B981'],
  'technical drawing': [Ruler, '#64748B'],
  'luganda': [Languages, '#F472B6'], 'french': [Languages, '#F472B6'], 'kiswahili': [Languages, '#F472B6'],
  'entrepreneurship': [TrendingUp, '#F59E0B'],
  'commerce': [ShoppingBag, '#CA8A04'],
  'economics': [TrendingUp, '#EAB308'],
  'agriculture': [Leaf, '#84CC16'],
  'general paper': [FileText, '#94A3B8'],
}

export function subjectMeta(subject: string): { icon: LucideIcon; color: string } {
  const match = SUBJECT_META[subject.toLowerCase().trim()]
  return match ? { icon: match[0], color: match[1] } : { icon: BookOpen, color: '#94A3B8' }
}

const SUBJECT_CATEGORY: Record<string, string> = {
  'mathematics': 'Sciences', 'physics': 'Sciences', 'chemistry': 'Sciences',
  'biology': 'Sciences', 'science': 'Sciences', 'computer studies': 'Sciences',
  'subsidiary ict': 'Sciences', 'ict': 'Sciences', 'agriculture': 'Sciences',
  'english': 'Languages', 'english language': 'Languages', 'literature': 'Languages',
  'literature in english': 'Languages', 'english literature': 'Languages',
  'luganda': 'Languages', 'french': 'Languages', 'kiswahili': 'Languages',
  'geography': 'Humanities', 'history': 'Humanities', 'social studies': 'Humanities',
  'religious education': 'Humanities', 'cre': 'Humanities', 'ire': 'Humanities',
  'divinity': 'Humanities', 'general paper': 'Humanities',
  'commerce': 'Business', 'economics': 'Business', 'entrepreneurship': 'Business',
  'home economics': 'Business',
  'fine art': 'Arts & Technical', 'art': 'Arts & Technical', 'music': 'Arts & Technical',
  'technical drawing': 'Arts & Technical', 'physical education': 'Arts & Technical',
}

const CATEGORY_ORDER = ['Sciences', 'Languages', 'Humanities', 'Business', 'Arts & Technical', 'Other']

function categoryFor(subject: string): string {
  return SUBJECT_CATEGORY[subject.toLowerCase().trim()] ?? 'Other'
}

function groupSubjects(list: string[]): { label: string; items: string[] }[] {
  const map: Record<string, string[]> = {}
  for (const s of list) {
    const k = categoryFor(s)
    ;(map[k] = map[k] || []).push(s)
  }
  return CATEGORY_ORDER.filter(k => map[k]?.length).map(k => ({ label: k, items: map[k] }))
}

function NavButton({ item, pathname, onClick }: { item: NavDef; pathname: string; onClick: () => void }) {
  const active = pathname.startsWith(item.path)
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${active ? '' : 'hover:bg-surface-var'}`}
      style={{ backgroundColor: active ? 'rgba(255,184,0,0.14)' : 'transparent' }}>
      <item.icon size={20} style={{ color: active ? item.accent : '#8A8AB0' }} />
      <span className="text-sm truncate"
        style={{ color: active ? '#FFB800' : '#A3A3C8', fontWeight: active ? 700 : 500 }}>
        {item.label}
      </span>
    </button>
  )
}

const SUBJECT_LIST_MAX_H = 180

interface ChatSidebarProps {
  profile: UserProfile
  subjects: string[]
  subjectsOpen: boolean
  currentSubject: string
  historyOpen: boolean
  subjectCounts: Record<string, number>
  onSubjectsToggle: () => void
  onNewChat: () => void
  onStartSubjectChat: (subject: string) => void
  onNavigate: (path: string) => void
  onOpenTimetable: () => void
  onOpenSettings: () => void
  onOpenHistory: () => void
  onLogout: () => void
  onCollapse: () => void
  onClose: () => void
  isMobile: boolean
}

export default function ChatSidebar(props: ChatSidebarProps) {
  const {
    profile, subjects, subjectsOpen, currentSubject, historyOpen, subjectCounts,
    onSubjectsToggle, onNewChat, onStartSubjectChat, onNavigate,
    onOpenTimetable, onOpenSettings, onOpenHistory, onLogout,
    onCollapse, onClose, isMobile,
  } = props

  const location = useLocation()
  const [subjectQuery, setSubjectQuery] = useState('')

  const activeSubject = currentSubject && subjects.includes(currentSubject) ? currentSubject : ''
  const showSubjectSearch = subjects.length > 8

  const q = subjectQuery.trim().toLowerCase()
  const filteredSubjects = q
    ? subjects.filter(s => `${s} ${categoryFor(s)}`.toLowerCase().includes(q))
    : subjects
  const subjectGroups = groupSubjects(filteredSubjects)
  const subjectListScrollable = filteredSubjects.length > 5
  const totalChatsInSubjects = Object.values(subjectCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="h-full bg-surface flex flex-col">

      <div className="flex items-center gap-2.5 px-3 pt-3 pb-3 shrink-0 bg-gradient-to-r from-surface to-surface-var">
        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden shrink-0"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A0A1F' }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
            : profile.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-text-white text-sm font-bold truncate">{profile.name || 'Student'}</p>
          <p className="text-text-disabled text-[11px] truncate">{profile.email}</p>
        </div>
        {isMobile ? (
          <button onClick={onClose} title="Close sidebar" aria-label="Close sidebar"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 hover:text-primary transition-colors">
            <X size={18} className="text-text-disabled" />
          </button>
        ) : (
          <button onClick={onCollapse} title="Collapse sidebar" aria-label="Collapse sidebar"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 hover:text-primary transition-colors">
            <PanelLeftClose size={18} className="text-text-disabled" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-4 pt-3">
        <button onClick={onNewChat}
          className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shrink-0"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#0A0A1F' }}>
          <Plus size={18} /> New Chat
        </button>

        {subjects.length > 0 && (
          <div className="shrink-0 mt-2">
            <button onClick={onSubjectsToggle}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-var transition-colors">
              <BookOpen size={20} style={{ color: activeSubject ? '#FFB800' : '#10B981' }} />
              <span className="text-sm" style={{ color: activeSubject ? '#FFB800' : '#A3A3C8', fontWeight: activeSubject ? 700 : 500 }}>Subjects</span>
              {totalChatsInSubjects > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                  title={`${totalChatsInSubjects} conversation${totalChatsInSubjects === 1 ? '' : 's'} across your subjects`}
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#B9B9DC' }}>
                  {totalChatsInSubjects}
                </span>
              )}
              <ChevronDown size={16} className={`ml-auto transition-transform ${subjectsOpen ? 'rotate-180' : ''}`} style={{ color: '#8A8AB0' }} />
            </button>

            {subjectsOpen && (
              <>
                {showSubjectSearch && (
                  <div className="mt-1 flex items-center gap-2 px-2.5 h-9 rounded-lg bg-surface-input border border-outline">
                    <Search size={14} className="text-text-disabled shrink-0" />
                    <input value={subjectQuery} onChange={e => setSubjectQuery(e.target.value)}
                      placeholder="Filter subjects…"
                      className="flex-1 bg-transparent outline-none text-xs text-text-white placeholder-text-disabled" />
                  </div>
                )}
                {filteredSubjects.length === 0 ? (
                  <p className="text-text-disabled text-xs mt-2 ml-4">No subjects match.</p>
                ) : (
                  <div className="relative mt-1">
                    {subjectListScrollable && (
                      <div className="pointer-events-none absolute -top-0.5 inset-x-0 h-3 z-10 rounded-t-md"
                        style={{ background: 'linear-gradient(to bottom, var(--color-surface), transparent)' }} />
                    )}
                    <div className="subject-list ml-4 pl-1.5 overflow-y-auto border-l"
                      style={{ borderColor: 'rgba(255,255,255,0.1)', maxHeight: SUBJECT_LIST_MAX_H }}>
                      {subjectGroups.map(g => (
                        <div key={g.label}>
                          <p className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5" style={{ color: '#9A9AC4' }}>{g.label}</p>
                          {g.items.map(s => {
                            const isActive = s === activeSubject
                            const count = subjectCounts[s] || 0
                            const meta = subjectMeta(s)
                            const Icon = meta.icon
                            return (
                              <button key={s} onClick={() => onStartSubjectChat(s)}
                                title={count > 0 ? `${count} conversation${count === 1 ? '' : 's'} in ${s}` : `Start a ${s} chat`}
                                className={`w-full flex items-center gap-2.5 pl-2 pr-2 py-2 leading-5 rounded-lg text-[13px] transition-colors ${isActive ? '' : 'hover:bg-surface-var'}`}
                                style={{
                                  backgroundColor: isActive ? 'rgba(255,184,0,0.16)' : 'transparent',
                                  color: isActive ? '#FFB800' : '#C0C0D8',
                                  fontWeight: isActive ? 700 : 500,
                                  boxShadow: isActive ? 'inset 3px 0 0 #FFB800' : undefined,
                                }}>
                                <Icon size={15} style={{ color: meta.color }} className="shrink-0" />
                                <span className="truncate">{s}</span>
                                {count > 0 && (
                                  <span className="ml-auto shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={{
                                      background: isActive ? 'rgba(255,184,0,0.2)' : 'rgba(255,255,255,0.08)',
                                      color: isActive ? '#FFB800' : '#B9B9DC',
                                    }}>
                                    {count}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                    {subjectListScrollable && (
                      <div className="pointer-events-none absolute -bottom-0.5 inset-x-0 h-3 z-10 rounded-b-md"
                        style={{ background: 'linear-gradient(to top, var(--color-surface), transparent)' }} />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#8E8EBB' }}>Explore</p>
          <div className="space-y-1">
            {NAV.map(item => (
              <NavButton key={item.path} item={item} pathname={location.pathname} onClick={() => onNavigate(item.path)} />
            ))}
            <button onClick={onOpenTimetable}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-var transition-colors">
              <Calendar size={20} style={{ color: '#C0C0D8' }} />
              <span className="text-sm" style={{ color: '#A3A3C8', fontWeight: 500 }}>Study Timetable</span>
            </button>
            <button onClick={onOpenHistory}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
              style={{ backgroundColor: historyOpen ? 'rgba(255,184,0,0.14)' : 'transparent' }}>
              <MessageSquare size={20} style={{ color: historyOpen ? '#FFB800' : '#8A8AB0' }} />
              <span className="text-sm" style={{ color: historyOpen ? '#FFB800' : '#A3A3C8', fontWeight: historyOpen ? 700 : 500 }}>Chats</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3 pt-2 shrink-0 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="space-y-1">
          <button onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-var transition-colors">
            <Settings size={20} className="text-text-disabled" />
            <span className="text-sm" style={{ color: '#A3A3C8', fontWeight: 500 }}>Settings</span>
          </button>
          <button onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-error/10 transition-colors">
            <LogOut size={20} className="text-error" /><span className="text-error text-sm">Logout</span>
          </button>
        </div>
      </div>
    </div>
  )
}