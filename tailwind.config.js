/** @type {import('tailwindcss').Config} */

const themedColor = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

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
          50: themedColor('ink-50'),
          100: themedColor('ink-100'),
          200: themedColor('ink-200'),
          300: themedColor('ink-300'),
          400: themedColor('ink-400'),
          500: themedColor('ink-500'),
          600: themedColor('ink-600'),
          700: themedColor('ink-700'),
          800: themedColor('ink-800'),
          900: themedColor('ink-900'),
          950: themedColor('ink-950'),
        },
        forest: {
          50: themedColor('forest-50'),
          100: themedColor('forest-100'),
          200: themedColor('forest-200'),
          300: themedColor('forest-300'),
          400: themedColor('forest-400'),
          500: themedColor('forest-500'),
          600: themedColor('forest-600'),
          700: themedColor('forest-700'),
          800: themedColor('forest-800'),
          900: themedColor('forest-900'),
          950: themedColor('forest-950'),
        },
        gold: {
          50: themedColor('gold-50'),
          100: themedColor('gold-100'),
          200: themedColor('gold-200'),
          300: themedColor('gold-300'),
          400: themedColor('gold-400'),
          500: themedColor('gold-500'),
          600: themedColor('gold-600'),
          700: themedColor('gold-700'),
          800: themedColor('gold-800'),
          900: themedColor('gold-900'),
        },
        parchment: {
          50: themedColor('parchment-50'),
          100: themedColor('parchment-100'),
          200: themedColor('parchment-200'),
          300: themedColor('parchment-300'),
          400: themedColor('parchment-400'),
          500: themedColor('parchment-500'),
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
