// Set VITE_API_BASE_URL in your .env or Vercel environment variables
// Default: local dev backend at port 3001
const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

export function apiUrl(name: string): string {
  return `${BASE}/${name}`
}

export function apiHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' }
}
