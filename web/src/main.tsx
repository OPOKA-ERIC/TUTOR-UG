import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {/* Mobile app frame — centers content like an Android phone on desktop */}
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div
            className="relative bg-bg overflow-hidden"
            style={{
              width: '100%',
              maxWidth: '430px',
              height: '100dvh',
              maxHeight: '100dvh',
            }}>
            <App />
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
