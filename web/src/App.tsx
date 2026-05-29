import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ChatPage from '@/pages/ChatPage'
import DocumentsPage from '@/pages/DocumentsPage'
import LearningPage from '@/pages/LearningPage'
import QuizPage from '@/pages/QuizPage'
import TimetablePage from '@/pages/TimetablePage'
import ProgressPage from '@/pages/ProgressPage'
import SettingsPage from '@/pages/SettingsPage'
import SplashPage from '@/pages/SplashPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return profile ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const { profile, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="h-full flex flex-col">
    <Routes>
      <Route path="/" element={<SplashPage />} />
      <Route path="/login" element={profile ? <Navigate to="/chat" replace /> : <LoginPage />} />
      <Route path="/register" element={profile ? <Navigate to="/chat" replace /> : <RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
      <Route path="/documents" element={<PrivateRoute><DocumentsPage /></PrivateRoute>} />
      <Route path="/learn" element={<PrivateRoute><LearningPage /></PrivateRoute>} />
      <Route path="/quiz" element={<PrivateRoute><QuizPage /></PrivateRoute>} />
      <Route path="/timetable" element={<PrivateRoute><TimetablePage /></PrivateRoute>} />
      <Route path="/progress" element={<PrivateRoute><ProgressPage /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </div>
  )
}
