/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#111827',
          sidebar: '#0B1220',
          purple: '#7047EB',
          'purple-hover': '#5E35D6',
          bg: '#F7F8FC',
          orange: '#F97316',
          'orange-dark': '#EA580C',
          cream: '#FFFBEB',
          charcoal: '#1F2937',
          success: '#16A34A',
          warning: '#F59E0B',
          danger: '#DC2626',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
        'elevated': '0 20px 30px -10px rgba(11, 18, 32, 0.12)',
      }
    },
  },
  plugins: [],
}
