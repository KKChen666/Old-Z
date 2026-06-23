/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ink: {
          50: '#f5f0e8',
          100: '#e8dfd0',
          200: '#d4c9a8',
          300: '#b8a87a',
          400: '#9a8a5a',
          500: '#6b6040',
          600: '#4a4230',
          700: '#3a3525',
          800: '#2a2a2a',
          900: '#1e1e1e',
          950: '#141414',
        },
        forest: {
          50: '#e8f0e8',
          100: '#c5dcc5',
          200: '#8fb88f',
          300: '#5a945a',
          400: '#3a7a3a',
          500: '#2a5a2a',
          600: '#1a4a1a',
          700: '#1a3a1a',
          800: '#1a2e1a',
          900: '#142414',
          950: '#0e1a0e',
        },
        gold: {
          50: '#fdf8ed',
          100: '#f8edcf',
          200: '#f0d89a',
          300: '#e8c46a',
          400: '#d4a853',
          500: '#c49240',
          600: '#a87830',
          700: '#8a5e25',
          800: '#6b4820',
          900: '#4a3218',
        },
        parchment: {
          50: '#fefcf8',
          100: '#f5f0e8',
          200: '#e8dfd0',
          300: '#d4c9a8',
          400: '#b8a87a',
          500: '#9a8a5a',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(212, 168, 83, 0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(212, 168, 83, 0.3)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
