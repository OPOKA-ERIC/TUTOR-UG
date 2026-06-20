export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const { meetingId, hostId, title, subject, scheduledAt, durationMins } = req.body
    const dailyKey = process.env.DAILY_API_KEY

    if (dailyKey) {
      const DAILY_API = 'https://api.daily.co/v1'
      const expiry = Math.floor(Date.now() / 1000) + ((durationMins || 60) + 30) * 60

      const roomRes = await fetch(`${DAILY_API}/rooms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${dailyKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: meetingId,
          privacy: 'private',
          properties: { exp: expiry, max_participants: 50, enable_chat: true, enable_screenshare: true },
        }),
      })
      const room = await roomRes.json()
      const roomUrl = room.url || `https://meet.jit.si/tutorug-${meetingId}`

      const hostRes = await fetch(`${DAILY_API}/meeting-tokens`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${dailyKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { room_name: meetingId, is_owner: true, exp: expiry } }),
      })
      const { token: hostToken } = await hostRes.json()

      const joinRes = await fetch(`${DAILY_API}/meeting-tokens`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${dailyKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { room_name: meetingId, is_owner: false, exp: expiry } }),
      })
      const { token: participantToken } = await joinRes.json()

      return res.json({ roomUrl, hostToken, participantToken })
    }

    const roomName = `tutorug-${meetingId.slice(0, 8)}`
    const roomUrl = `https://meet.jit.si/${roomName}`
    res.json({ roomUrl, hostToken: '', participantToken: '' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
