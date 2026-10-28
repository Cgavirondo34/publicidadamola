/** @type {import('tailwindcss').Config} */
// Paleta tomada del Manual de Marca AMOLA (valores HEX relevados del packaging).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verde Amola #4E8B3B = 500
        amola: {
          50: '#f2f7ef', 100: '#e0eed8', 200: '#c2ddb3', 300: '#9cc585', 400: '#74a95b',
          500: '#4e8b3b', 600: '#3f7330', 700: '#335c28', 800: '#2b4a23', 900: '#243e1f', 950: '#13230f',
        },
        // Mostaza #E3B84F = 500
        mostaza: { 300: '#f0d58f', 400: '#e9c76c', 500: '#e3b84f', 600: '#c99a2f' },
        terracota: { 500: '#bc5534', 700: '#8c1f14' },
        lenteja: { 500: '#4673bb' },
        arena: { 100: '#f6efe4', 300: '#e3d2bd', 500: '#c2a182' },
        tierra: { 900: '#2a211a', 800: '#3b3027', 700: '#4d4034' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Nunito', 'Inter', 'sans-serif'],
        serif: ['"Bree Serif"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
