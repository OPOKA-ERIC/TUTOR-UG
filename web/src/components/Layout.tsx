import { NavLink, useLocation } from 'react-router-dom'
import { MessageSquare, FileText, Calendar, BarChart2, Settings, Video, Users, Mic } from 'lucide-react'

const NAV = [
  { to: '/chat',      icon: MessageSquare, label: 'Chat' },
  { to: '/meetings',  icon: Video,         label: 'Meetings' },
  { to: '/rooms',     icon: Users,         label: 'Rooms' },
  { to: '/podcast',   icon: Mic,           label: 'Podcast' },
  { to: '/documents', icon: FileText,      label: 'Docs' },
  { to: '/timetable', icon: Calendar,      label: 'Timetable' },
  { to: '/progress',  icon: BarChart2,     label: 'Progress' },
  { to: '/settings',  icon: Settings,      label: 'Settings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const hideNav = pathname === '/settings'

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </main>

      {!hideNav && (
        <nav className="shrink-0 bg-surface border-t border-outline flex items-center justify-around px-2 py-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0
                 ${isActive ? 'text-primary' : 'text-text-disabled hover:text-text-light'}`
              }>
              {({ isActive }) => (
                <>
                  <Icon size={22} />
                  <span className="text-xs font-medium">{label}</span>
                  {isActive && <div className="w-1 h-1 rounded-full bg-primary" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
