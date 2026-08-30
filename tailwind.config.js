/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Segoe UI',
          'Apple SD Gothic Neo',
          'Noto Sans KR',
          'Malgun Gothic',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d4d8e0',
          300: '#aeb5c4',
          400: '#818ba2',
          500: '#626d87',
          600: '#4d566d',
          700: '#3f4658',
          800: '#363c4b',
          900: '#181b23',
          950: '#0e1015',
        },
        brand: {
          50: '#eef6ff',
          100: '#d9ecff',
          200: '#bcdeff',
          300: '#8ec9ff',
          400: '#59aaff',
          500: '#3387fb',
          600: '#1d68f0',
          700: '#1653dd',
          800: '#1846b3',
          900: '#1a3f8d',
        },
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-in': 'fade-in 140ms ease-out',
      },
    },
  },
  plugins: [],
};
