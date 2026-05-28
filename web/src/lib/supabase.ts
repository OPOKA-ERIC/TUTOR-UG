import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://jsjhgwficdrgzwbwzkhm.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzamhnd2ZpY2RyZ3p3Ynd6a2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDUyNzQsImV4cCI6MjA5MDc4MTI3NH0.wlHsR1BNFBWV2UGQ1pnxlqoSdKhB6tYHVgwM2sLL5MU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export { SUPABASE_URL, SUPABASE_ANON }
