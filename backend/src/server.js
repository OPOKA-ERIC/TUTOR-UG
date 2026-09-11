import express from 'express'
import cors from 'cors'

import sendChatMessage from './routes/send-chat-message.js'
import generateQuiz from './routes/generate-quiz.js'
import processDocument from './routes/process-document.js'
import createMeeting from './routes/create-meeting.js'
import moderateMessage from './routes/moderate-message.js'
import generatePodcast from './routes/generate-podcast.js'
import sendOtp from './routes/send-otp.js'
import verifyOtp from './routes/verify-otp.js'
import resetPassword from './routes/reset-password.js'
import sendReminder from './routes/send-reminder.js'
import exportData from './routes/export-data.js'
import deleteData from './routes/delete-data.js'
import inviteToMeeting from './routes/invite-to-meeting.js'
import respondInvite from './routes/respond-invite.js'

import { requireAuth } from './middleware/auth.js'
import { generalLimiter, authLimiter, aiLimiter } from './middleware/rate-limit.js'

const app = express()
const PORT = process.env.PORT || 3001

// ── CORS: restrict to known TutorUG origins ─────────────────────────────
// Native mobile apps don't send an Origin header, so they are unaffected.
const defaultOrigins = [
  'https://tutorug.com',
  'https://www.tutorug.com',
  'https://tutorug.vercel.app',
  'https://www.tutorug.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || defaultOrigins.join(','))
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
)

app.use(cors({
  origin(origin, cb) {
    // Allow non-browser clients (curl, mobile, server-to-server) with no Origin.
    if (!origin || allowedOrigins.has(origin)) return cb(null, true)
    return cb(null, false)
  },
  credentials: false,
}))

app.use(express.json({ limit: '10mb' }))

// ── Health check (light public endpoint) ────────────────────────────────
app.get('/health', generalLimiter, (_req, res) => res.json({ status: 'ok' }))

// ── Public password-reset flow (works while signed out) ─────────────────
app.use('/api/send-otp', authLimiter, sendOtp)
app.use('/api/verify-otp', authLimiter, verifyOtp)
app.use('/api/reset-password', authLimiter, resetPassword)

// ── Protected endpoints (require a valid Supabase JWT) ──────────────────
app.use('/api/send-chat-message', requireAuth, aiLimiter, sendChatMessage)
app.use('/api/generate-quiz', requireAuth, aiLimiter, generateQuiz)
app.use('/api/process-document', requireAuth, aiLimiter, processDocument)
app.use('/api/create-meeting', requireAuth, aiLimiter, createMeeting)
app.use('/api/moderate-message', requireAuth, aiLimiter, moderateMessage)
app.use('/api/generate-podcast', requireAuth, aiLimiter, generatePodcast)
app.use('/api/send-reminder', requireAuth, generalLimiter, sendReminder)
app.use('/api/invite-to-meeting', requireAuth, generalLimiter, inviteToMeeting)
app.use('/api/respond-invite', requireAuth, generalLimiter, respondInvite)
app.use('/api/export-data', requireAuth, generalLimiter, exportData)
app.use('/api/delete-data', requireAuth, generalLimiter, deleteData)

app.listen(PORT, () => {
  console.log(`TutorUG API running on port ${PORT}`)
})