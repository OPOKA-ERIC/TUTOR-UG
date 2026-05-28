import { NavLink, useNavigate } from 'react-router-dom'
import { MessageSquare, FileText, Calendar, BarChart2, Settings, LogOut, BookOpen } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import Logo from './Logo'

const NAV = [
  { to: '/chat',      icon: MessageSquare, label: 'Chat' },
  { to: '/documents', icon: FileText,      label: 'Documents' },
  { to: '/timetable', icon: Calendar,      label: 'Timetable' },
  { to: '/progress',  icon: BarChart2,     label: 'Progress' },
  { to: '/settings',  icon: Settings,      label: 'Settings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-64 bg-surface border-r border-outline flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-outline">
          <Logo />
          <p className="text-text-disabled text-xs mt-1">Uganda's Smart Learning Companion</p>
        </div>

        {/* User info */}
        {profile && (
          <div className="px-4 py-3 border-b border-outline">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                  : profile.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-text-white text-sm font-semibold truncate">{profile.name}</p>
                <p className="text-text-disabled text-xs truncate">{profile.education_level} · {profile.district}</p>
              </div>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-outline">
          <button onClick={handleLogout} className="sidebar-item w-full text-error hover:bg-error/10 hover:text-error">
            <LogOut size={18} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
