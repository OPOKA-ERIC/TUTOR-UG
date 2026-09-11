import {
  ApiError, corsHeaders, handlePreflight, requireUser, json,
  isNonEmptyString, isOptionalString,
} from "../_shared/security.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const CORS = corsHeaders(req);

  try {
const auth = requireUser(req);

    const body = await req.json();
    const { meetingId, hostId, title, subject, scheduledAt, durationMins, userName } = body;

    if (!isNonEmptyString(meetingId, 128)) throw new ApiError(400, "Meeting ID is required.");
    if (!isNonEmptyString(hostId, 128)) throw new ApiError(400, "Host ID is required.");
    if (auth.userId !== hostId) throw new ApiError(403, "You can only create meetings as yourself.");
    if (!isOptionalString(title, 200)) throw new ApiError(400, "Invalid meeting title.");
    if (!isOptionalString(subject, 120)) throw new ApiError(400, "Invalid meeting subject.");

    const dailyKey = Deno.env.get("DAILY_API_KEY");

    if (dailyKey) {
      const DAILY_API = "https://api.daily.co/v1";
      const expiry = Math.floor(Date.now() / 1000) + ((durationMins || 60) + 30) * 60;

      const roomRes = await fetch(`${DAILY_API}/rooms`, {
        method: "POST",
        headers: { Authorization: `Bearer ${dailyKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: meetingId,
          privacy: "private",
          properties: { exp: expiry, max_participants: 50, enable_chat: true, enable_screenshare: true },
        }),
      });
      const room = await roomRes.json();
      const roomUrl = room.url || `https://meet.jit.si/tutorug-${meetingId}`;

      const hostRes = await fetch(`${DAILY_API}/meeting-tokens`, {
method: "POST",
        headers: { Authorization: `Bearer ${dailyKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ properties: { room_name: meetingId, is_owner: true, exp: expiry, user_name: userName || 'Host' } }),
      });
      const { token: hostToken } = await hostRes.json();

      const joinRes = await fetch(`${DAILY_API}/meeting-tokens`, {
        method: "POST",
        headers: { Authorization: `Bearer ${dailyKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ properties: { room_name: meetingId, is_owner: false, exp: expiry, user_name: userName || 'Participant' } }),
      });
      const { token: participantToken } = await joinRes.json();

      return json({ roomUrl, hostToken, participantToken }, 200, CORS);
    }

const roomName = `tutorug-${meetingId.slice(0, 8)}`;
    const displayName = encodeURIComponent(userName || 'Participant')
    const roomUrl = `https://meet.jit.si/${roomName}#config.displayName="${displayName}"&config.prejoinPageEnabled=false`;
    return json({ roomUrl, hostToken: "", participantToken: "" }, 200, CORS);
  } catch (error: any) {
    const status = error instanceof ApiError ? error.status : 500;
    return json({ error: error.message }, status, CORS);
  }
});