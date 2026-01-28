/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Couleurs MTG inspirées
        mtg: {
          white: '#FFFBD5',
          blue: '#0E68AB',
          black: '#150B00',
          red: '#D3202A',
          green: '#00733E',
          gold: '#E49B0F',
          artifact: '#A4A4A4',
          land: '#A67C52',
          // Couleurs d'interface
          background: '#1a1a1a',
          surface: '#2a2a2a',
          primary: '#E49B0F',
          secondary: '#D3202A',
          accent: '#0E68AB',
        },
      },
      fontFamily: {
        'mtg': ['Beleren', 'serif'],
        'body': ['Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(228, 155, 15, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(228, 155, 15, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
