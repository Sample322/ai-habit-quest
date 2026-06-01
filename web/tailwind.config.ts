import type { Config } from 'tailwindcss';

// Onyx Sport Luxury design system.
// Palette: deep onyx base (warm-black), platinum text, electric accent.
// Type: Manrope variable for everything; numeric pairs with tabular-nums.
// Surfaces: layered glass with subtle gradient + 1px hairline borders.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base layers — graded onyx (each step is a perceptual jump, not linear).
        bg: 'var(--tg-theme-bg-color, #08090c)',          // deepest
        surface: 'var(--tg-theme-secondary-bg-color, #11131a)',
        // Elevated surfaces (cards, sheets) — slightly warmer.
        elevated: '#181b24',
        // Hairline borders (1px alpha).
        hairline: 'rgba(255,255,255,0.06)',
        hairlineStrong: 'rgba(255,255,255,0.12)',

        // Text — high-contrast platinum + cool muted.
        text: 'var(--tg-theme-text-color, #f5f7fb)',
        muted: 'var(--tg-theme-hint-color, #7c8290)',
        dim: '#4d5260',

        // Accent — electric violet (kept Telegram-bridgeable).
        accent: 'var(--tg-theme-button-color, #7c5cff)',
        accentText: 'var(--tg-theme-button-text-color, #ffffff)',
        accentGlow: '#9b7dff',
        link: 'var(--tg-theme-link-color, #7c5cff)',

        // Semantic.
        positive: '#19d57a',
        warning: '#f5a524',
        danger: '#ef4444',

        // Rarity (badges).
        rarBronze: '#c08a4f',
        rarSilver: '#c9d1dc',
        rarGold: '#f3c969',
        rarSecret: '#d57bff',
      },
      borderRadius: {
        sm: '8px',
        card: '20px',
        xl: '24px',
        pill: '999px',
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Manrope Variable"', 'Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Tighter than Tailwind defaults; designed for HUD-like numeric hierarchy.
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.08em' }],
        'xs': ['11px', { lineHeight: '15px' }],
        'sm': ['13px', { lineHeight: '18px' }],
        'base': ['15px', { lineHeight: '22px' }],
        'lg': ['17px', { lineHeight: '24px' }],
        'xl': ['20px', { lineHeight: '26px', letterSpacing: '-0.01em' }],
        '2xl': ['26px', { lineHeight: '30px', letterSpacing: '-0.02em' }],
        '3xl': ['34px', { lineHeight: '36px', letterSpacing: '-0.025em' }],
        '4xl': ['44px', { lineHeight: '46px', letterSpacing: '-0.03em' }],
        '5xl': ['56px', { lineHeight: '56px', letterSpacing: '-0.035em' }],
        '6xl': ['72px', { lineHeight: '70px', letterSpacing: '-0.04em' }],
      },
      boxShadow: {
        glow: '0 0 32px -8px rgba(124,92,255,0.55)',
        card: '0 10px 30px -16px rgba(0,0,0,0.7), 0 1px 0 0 rgba(255,255,255,0.04) inset',
        soft: '0 8px 24px -16px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        aurora: 'radial-gradient(60% 80% at 50% 0%, rgba(124,92,255,0.18) 0%, rgba(124,92,255,0) 60%), radial-gradient(80% 60% at 100% 100%, rgba(25,213,122,0.10) 0%, rgba(25,213,122,0) 50%)',
        grid: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        accentGrad: 'linear-gradient(135deg, #7c5cff 0%, #9b7dff 60%, #c4a6ff 100%)',
        successGrad: 'linear-gradient(135deg, #19d57a 0%, #5fe3a6 100%)',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
      animation: {
        'fade-in': 'fadeIn 320ms cubic-bezier(0.16,1,0.3,1) both',
        'rise': 'rise 480ms cubic-bezier(0.16,1,0.3,1) both',
        'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
        'shine': 'shine 2.4s linear infinite',
        'pop': 'pop 360ms cubic-bezier(0.34,1.56,0.64,1) both',
        'tick': 'tick 240ms ease-out both',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(124,92,255,0.35)' },
          '50%': { boxShadow: '0 0 24px 6px rgba(124,92,255,0.45)' },
        },
        shine: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '60%': { opacity: '1', transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
        tick: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
