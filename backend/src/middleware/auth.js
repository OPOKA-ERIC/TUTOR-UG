import { createClient } from '@supabase/supabase-js'

let adminClient = null

function getAdminClient() {
  if (!adminClient) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for authentication')
    }
    adminClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return adminClient
}

export function extractToken(req) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

// Verifies the JWT against Supabase Auth and attaches req.user.
// Protects routes that handle user data or spend money on AI / email APIs.
export async function requireAuth(req, res, next) {
  const token = extractToken(req)
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in and try again.' })
  }

  try {
    const { data, error } = await getAdminClient().auth.getUser(token)
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' })
    }
    req.user = {
      id: data.user.id,
      email: data.user.email || '',
    }
    req.authToken = token
    return next()
  } catch (e) {
    console.error('[auth] Could not verify session:', e.message)
    return res.status(500).json({ error: 'Could not verify your session. Please try again.' })
  }
}

// Captures the token if present without requiring it. Used by
// the password-reset flow which must work for signed-out users.
export function optionalAuth(req, _res, next) {
  const token = extractToken(req)
  if (token) {
    req.authToken = token
  }
  return next()
}