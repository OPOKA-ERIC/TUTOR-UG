import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const SUPABASE_URL = 'https://jsjhgwficdrgzwbwzkhm.supabase.co'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/auth':   { target: SUPABASE_URL, changeOrigin: true },
      '/rest':   { target: SUPABASE_URL, changeOrigin: true },
      '/storage':{ target: SUPABASE_URL, changeOrigin: true },
      '/functions': { target: SUPABASE_URL, changeOrigin: true },
    },
  },
})