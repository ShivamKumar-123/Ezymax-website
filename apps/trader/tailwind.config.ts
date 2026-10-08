import type { Config } from 'tailwindcss';

/**
 * Ezymex website design tokens. Colours mirror the platform tokens in the Ezymex repo
 * (packages/ui/src/styles.css): bg #07070a, ember #ff5a1f → #ff8a3d. The website is dark only.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        ink: {
          DEFAULT: '#07070a',
          2: '#0c0c10',
          3: '#111114',
          4: '#17171c',
          5: '#1e1e24',
        },
        fg: {
          DEFAULT: '#f5f5f7',
          2: '#b4b4bd',
          3: '#8d8d97',
        },
        line: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          2: 'rgba(255,255,255,0.14)',
        },
        ember: {
          DEFAULT: '#ff5a1f',
          2: '#ff8a3d',
          deep: '#c2370c',
          soft: 'rgba(255,90,31,0.12)',
        },
        cream: '#f3ede4',
        up: '#22c55e',
        down: '#f04438',
      },
      fontFamily: {
        sans: ['var(--font-geist)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-geist)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        pixel: ['var(--font-pixel)', 'var(--font-geist-mono)', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.055em',
        tighter: '-0.04em',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      maxWidth: {
        site: '1360px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        expo: 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translate3d(0,0,0)' },
          to: { transform: 'translate3d(-50%,0,0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.06)' },
        },
        sweep: {
          '0%': { transform: 'translateX(-60%) rotate(-12deg)', opacity: '0' },
          '20%': { opacity: '1' },
          '60%': { opacity: '1' },
          '100%': { transform: 'translateX(160%) rotate(-12deg)', opacity: '0' },
        },
        'scroll-dot': {
          '0%': { transform: 'translateY(0)', opacity: '0' },
          '30%': { opacity: '1' },
          '100%': { transform: 'translateY(18px)', opacity: '0' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(255,90,31,0.55)' },
          '100%': { boxShadow: '0 0 0 10px rgba(255,90,31,0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        marquee: 'marquee var(--marquee-duration, 60s) linear infinite',
        'glow-pulse': 'glow-pulse 6s ease-in-out infinite',
        sweep: 'sweep 7s cubic-bezier(0.65, 0, 0.35, 1) infinite',
        'scroll-dot': 'scroll-dot 1.8s cubic-bezier(0.65, 0, 0.35, 1) infinite',
        'spin-slow': 'spin 18s linear infinite',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
        float: 'float 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
