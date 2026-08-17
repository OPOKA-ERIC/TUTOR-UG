import { SUPABASE_URL } from './supabase'

// Set VITE_API_BASE_URL in your .env or Vercel environment variables
// Default: local dev backend at port 3001
const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

// AI endpoints go to Supabase Edge Functions (bypass Express backend to avoid "Premature close")
const EDGE_FUNCTIONS = new Set([
  'send-chat-message',
  'generate-quiz',
  'generate-podcast',
  'process-document',
  'moderate-message',
])

export function apiUrl(name: string): string {
  if (EDGE_FUNCTIONS.has(name)) {
    return `${SUPABASE_URL}/functions/v1/${name}`
  }
  return `${BASE}/${name}`
}

export function apiHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' }
}
