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

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/send-chat-message', sendChatMessage)
app.use('/api/generate-quiz', generateQuiz)
app.use('/api/process-document', processDocument)
app.use('/api/create-meeting', createMeeting)
app.use('/api/moderate-message', moderateMessage)
app.use('/api/generate-podcast', generatePodcast)
app.use('/api/send-otp', sendOtp)
app.use('/api/verify-otp', verifyOtp)
app.use('/api/reset-password', resetPassword)
app.use('/api/send-reminder', sendReminder)

app.listen(PORT, () => {
  console.log(`TutorUG API running on port ${PORT}`)
})
