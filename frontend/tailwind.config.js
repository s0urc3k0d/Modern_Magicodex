/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'mtg-background': '#1a1a1a',
        'mtg-surface': '#2a2a2a',
        'mtg-primary': '#E49B0F',
        'mtg-secondary': '#D3202A',
        'mtg-accent': '#0E68AB',
        'mtg-black': '#150B00',
        'mtg-green': '#00733E',
      },
      fontFamily: {
        'body': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
