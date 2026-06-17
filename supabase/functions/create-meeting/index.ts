const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { meetingId, hostId, title, subject, scheduledAt, durationMins } = await req.json()
    const dailyKey = Deno.env.get('DAILY_API_KEY')

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

      return new Response(JSON.stringify({ roomUrl, hostToken, participantToken }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // No Daily key — use free Jitsi Meet room (always works, no API key needed)
    const roomName = `tutorug-${meetingId.slice(0, 8)}`
    const roomUrl = `https://meet.jit.si/${roomName}`
    return new Response(JSON.stringify({
      roomUrl,
      hostToken: '',
      participantToken: '',
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
