/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // All colors reference CSS variables injected by ThemeContext
        bg:             'var(--color-bg)',
        surface:        'var(--color-surface)',
        'surface-var':  'var(--color-surface-var)',
        'surface-card': 'var(--color-surface-card)',
        'surface-input':'var(--color-surface-input)',
        primary:        'var(--color-primary)',
        'primary-dark': 'var(--color-primary-dark)',
        secondary:      'var(--color-secondary)',
        tertiary:       'var(--color-tertiary)',
        error:          '#EF4444',
        outline:        'var(--color-outline)',
        // Text — fixed across all themes
        'text-white':   '#F0F0FF',
        'text-light':   '#C0C0D8',
        'text-disabled':'#606080',
        // Fixed accents
        lime:           '#84CC16',
        'lime-dark':    '#65A30D',
        amber:          '#F59E0B',
        coral:          '#F87171',
        ink:            '#0A0A1F',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'grad-primary': 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
        'grad-bar':     'linear-gradient(90deg, var(--color-bar-start), var(--color-bar-end))',
        'grad-page':    'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg) 100%)',
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
