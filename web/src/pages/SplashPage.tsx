import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import Logo from '@/components/Logo'

export default function SplashPage() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading) {
      setTimeout(() => navigate(profile ? '/chat' : '/login'), 1500)
    }
  }, [loading, profile])

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl scale-150" />
        <Logo size="lg" />
      </div>
      <p className="text-text-disabled text-sm animate-pulse-slow">Uganda's Smart Learning Companion</p>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mt-4" />
    </div>
  )
}
