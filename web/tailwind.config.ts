import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EFF5FF',
          100: '#DDEAFE',
          200: '#BBD4FE',
          300: '#8DB6FE',
          400: '#6298FD',
          500: '#3C7DF6',
          600: '#1E63E5',
          700: '#0E4CC7',
          800: '#0C3C9E',
          900: '#0D357F'
        },
        surface: '#ffffff',
        ink: {
          900: '#0F172A',
          700: '#1E293B',
          500: '#475569',
          300: '#94A3B8'
        },
        accent: '#F97316',
        success: '#22C55E'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        body: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 16px 48px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
};

export default config;
