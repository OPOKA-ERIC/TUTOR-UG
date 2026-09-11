import { isNonEmptyString, isOptionalString, isPositiveNumber, fail } from '../utils/validate.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
const { meetingId, hostId, title, subject, scheduledAt, durationMins, userName } = req.body

    if (!isNonEmptyString(meetingId, 128)) return fail(res, 'Meeting ID is required.')
    if (!isNonEmptyString(hostId, 128)) return fail(res, 'Host ID is required.')
    if (req.user?.id && req.user.id !== hostId) {
      return fail(res, 'You can only create meetings as yourself.', 403)
    }
    if (!isOptionalString(title, 200)) return fail(res, 'Invalid meeting title.')
    if (!isOptionalString(subject, 120)) return fail(res, 'Invalid meeting subject.')
    if (durationMins !== undefined && !isPositiveNumber(durationMins, 600)) {
      return fail(res, 'Invalid meeting duration.')
    }

    const dailyKey = process.env.DAILY_API_KEY

    if (dailyKey) {
      try {
        const DAILY_API = 'https://api.daily.co/v1'
        const expiry = Math.floor(Date.now() / 1000) + ((durationMins || 60) + 30) * 60

        const roomRes = await fetch(`${DAILY_API}/rooms`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${dailyKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: meetingId,
            privacy: 'private',
            properties: { exp: expiry, max_participants: 10, enable_chat: true, enable_screenshare: true },
          }),
        })
        const room = await roomRes.json()
        const roomUrl = room.url
        if (roomUrl && roomRes.ok) {
          const hostRes = await fetch(`${DAILY_API}/meeting-tokens`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${dailyKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties: { room_name: meetingId, is_owner: true, exp: expiry, user_name: userName || 'Host' } }),
          })
          const { token: hostToken } = await hostRes.json()

          const joinRes = await fetch(`${DAILY_API}/meeting-tokens`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${dailyKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties: { room_name: meetingId, is_owner: false, exp: expiry, user_name: userName || 'Participant' } }),
          })
          const { token: participantToken } = await joinRes.json()

          return res.json({ roomUrl, hostToken, participantToken })
        }
      } catch {
        // Daily unavailable (e.g. missing payment method) -> fall through to Jitsi
      }
    }

    const roomName = `tutorug-${meetingId.slice(0, 8)}`
    const displayName = encodeURIComponent(userName || 'Participant')
    const roomUrl = `https://meet.jit.si/${roomName}#config.displayName="${displayName}"&config.prejoinPageEnabled=false&config.requireDisplayName=false&config.disableDeepLinking=true&interfaceConfig.disableDeepLinking=true`
    res.json({ roomUrl, hostToken: '', participantToken: '' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}