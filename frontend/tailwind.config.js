/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: {
            950: '#0A121A',
            900: '#0F1A25',
            850: '#131E2A',
            800: '#16212F',
            700: '#1E2D3E',
            600: '#2A3C52',
          },
          accent: {
            DEFAULT: '#F3A221',
            hover: '#FFB74D',
            active: '#D98A12',
            light: 'rgba(243, 162, 33, 0.12)',
            glow: 'rgba(243, 162, 33, 0.25)',
          },
          cream: {
            50: '#FAFAF7',
            100: '#F7F5F0',
            200: '#EFECE4',
          },
          slate: {
            300: '#CBD5E1',
            400: '#94A3B8',
            500: '#64748B',
            600: '#5B6472',
            700: '#334155',
          },
        },
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'Montserrat', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'IBM Plex Mono', 'monospace'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
