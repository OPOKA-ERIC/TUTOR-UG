/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── TutorUG Deep Space Theme (matches Android exactly) ──
        bg:           '#0A0A1F',
        surface:      '#12122A',
        'surface-var':'#1A1A3A',
        'surface-card':'#1E1E40',
        'surface-input':'#252545',
        primary:      '#FFB800',   // Gold
        'primary-dark':'#E6A500',
        secondary:    '#7C3AED',   // Violet
        tertiary:     '#6D28D9',
        error:        '#EF4444',
        outline:      '#2A2A4A',
        // Text
        'text-white': '#F0F0FF',
        'text-light': '#C0C0D8',
        'text-disabled':'#606080',
        // Accents
        lime:         '#84CC16',
        'lime-dark':  '#65A30D',
        amber:        '#F59E0B',
        coral:        '#F87171',
        ink:          '#0A0A1F',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'grad-primary': 'linear-gradient(135deg, #FFB800, #E6A500)',
        'grad-bar':     'linear-gradient(90deg, #12122A, #1A1A3A)',
        'grad-page':    'linear-gradient(180deg, #12122A 0%, #0A0A1F 100%)',
        'grad-violet':  'linear-gradient(135deg, #7C3AED, #6D28D9)',
        'grad-lime':    'linear-gradient(135deg, #84CC16, #65A30D)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.3s ease-in-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'spin-slow':  'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}
