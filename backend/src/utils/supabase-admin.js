export function getDbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

export function getSupabaseUrl() {
  return process.env.SUPABASE_URL
}
