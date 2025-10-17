/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        midnight: '#0b021f',
        amethyst: '#6633ff',
        orchid: '#b388ff',
        obsidian: '#0f0a1f'
      },
      backgroundImage: {
        'sovereign-gradient': 'radial-gradient(circle at top, rgba(102,51,255,0.35), transparent 55%), radial-gradient(circle at bottom, rgba(179,136,255,0.25), transparent 60%)'
      },
      boxShadow: {
        neon: '0 0 20px rgba(179,136,255,0.45)'
      }
    }
  },
  plugins: []
};
