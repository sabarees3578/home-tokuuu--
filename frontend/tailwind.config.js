/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // We'll force this or use it dynamically, but OLED dark is the default.
  theme: {
    extend: {
      colors: {
        security: {
          bg: {
            dark: '#0F172A', // OLED deep midnight
            light: '#0F172A', // Forcing dark for luxury feel
          },
          card: {
            dark: '#1E293B',
            light: '#1E293B',
          },
          border: {
            dark: '#475569',
            light: '#475569',
          },
          accent: '#22C55E', // Green status
          muted: '#272F42',
        }
      },
      fontFamily: {
        sans: ['Jost', 'sans-serif'],
        display: ['Bodoni Moda', 'serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-green': 'glowGreen 2s infinite alternate',
        'glow-red': 'glowRed 2s infinite alternate',
        'glow-accent': 'glowAccent 2s infinite alternate',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
      },
      keyframes: {
        glowGreen: {
          '0%': { textShadow: '0 0 5px rgba(34, 197, 94, 0.2)' },
          '100%': { textShadow: '0 0 15px rgba(34, 197, 94, 0.6), 0 0 25px rgba(34, 197, 94, 0.3)' }
        },
        glowRed: {
          '0%': { textShadow: '0 0 5px rgba(239, 68, 68, 0.2)' },
          '100%': { textShadow: '0 0 15px rgba(239, 68, 68, 0.6), 0 0 25px rgba(239, 68, 68, 0.3)' }
        },
        glowAccent: {
          '0%': { boxShadow: '0 0 5px rgba(34, 197, 94, 0.2), 0 0 10px rgba(34, 197, 94, 0.1)' },
          '100%': { boxShadow: '0 0 15px rgba(34, 197, 94, 0.6), 0 0 25px rgba(34, 197, 94, 0.3)' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(15px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
