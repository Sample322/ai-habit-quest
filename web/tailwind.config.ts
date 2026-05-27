import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--tg-theme-bg-color, #0f1115)',
        surface: 'var(--tg-theme-secondary-bg-color, #1a1d23)',
        text: 'var(--tg-theme-text-color, #f5f5f7)',
        muted: 'var(--tg-theme-hint-color, #8a8f98)',
        accent: 'var(--tg-theme-button-color, #6f7cf7)',
        accentText: 'var(--tg-theme-button-text-color, #ffffff)',
        link: 'var(--tg-theme-link-color, #6f7cf7)',
        positive: '#3ecf8e',
        danger: '#ef4444',
      },
      borderRadius: {
        card: '18px',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
