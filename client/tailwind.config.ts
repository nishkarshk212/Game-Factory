/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      colors: {
        sonic: {
          bg: '#070913',
          surface: '#0F1528',
          card: '#141B33',
          cyan: '#00F0FF',
          violet: '#7C3AED',
          magenta: '#EC4899',
          emerald: '#10B981'
        }
      },
      boxShadow: {
        neon: '0 0 24px rgba(0, 240, 255, 0.25)',
        'neon-violet': '0 0 24px rgba(124, 58, 237, 0.3)',
        'neon-pink': '0 0 24px rgba(236, 72, 153, 0.28)'
      }
    }
  },
  plugins: []
};

