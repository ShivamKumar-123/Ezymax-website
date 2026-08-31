import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          hover: 'var(--bg-hover)',
          active: 'var(--bg-active)',
          input: 'var(--bg-input)',
          glass: 'var(--bg-glass)',
          'glass-light': 'var(--bg-glass-light)',
          'glass-heavy': 'var(--bg-glass-heavy)',
          base: 'var(--bg-base)',
        },
        /* crucial-ui style surfaces */
        card: {
          DEFAULT: 'var(--bg-card)',
          nested: 'var(--bg-card-nested)',
        },
        border: {
          primary: 'var(--border-primary)',
          secondary: 'var(--border-secondary)',
          accent: 'var(--border-accent)',
          glass: 'var(--border-glass)',
          'glass-bright': 'var(--border-glass-bright)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          inverse: 'var(--text-inverse)',
        },
        buy: {
          DEFAULT: '#1E66F5',
          light: '#5B8CFF',
          dark: '#0D3FA3',
          bg: 'rgba(30,102,245,0.1)',
          glow: 'rgba(30,102,245,0.22)',
        },
        sell: {
          DEFAULT: '#DC2626',
          light: '#f87171',
          dark: '#b91c1c',
          bg: 'rgba(220,38,38,0.1)',
          glow: 'rgba(220,38,38,0.2)',
        },
        /* Vantage-style accent — orange #E94E1B for CTAs, brand marks, NEW badges. */
        accent: {
          DEFAULT: '#E94E1B',
          hover: '#C73E11',
          soft: '#FCE6DD',
          light: '#F58A60',
          dark: '#C73E11',
        },
        success: '#10B981',
        warning: '#F59E0B',
        info: '#29B6F6',
        danger: '#DC2626',
        rainbow: {
          red: '#FF6B6B',
          orange: '#FFA94D',
          yellow: '#FFD43B',
          green: '#69DB7C',
          blue: '#4DABF7',
          purple: '#9775FA',
          pink: '#F06595',
        },
        /* Landing-page palette — SwissCresta brand */
        'primary': {
          bg: '#FFFFFF',
          secondary: '#FAFAFA',
          accent: '#E94E1B',
          purple: '#C73E11',
        },
        /* ─────────────────────────────────────────────────────────
           Marketing site palette (`mkt.*` namespace)

           These are the tokens the new marketing chrome + home
           sections use. They're CSS-variable references resolving to
           values defined in `src/styles/marketing.css`, scoped under
           `[data-mkt]` so the trader app's existing tokens stay
           untouched. Utility class names follow Tailwind's nested
           convention — `bg-mkt-canvas`, `text-mkt-ink-primary`,
           `border-mkt-line`, `text-mkt-accent`, etc.
           ───────────────────────────────────────────────────────── */
        mkt: {
          /* Surfaces */
          canvas:   'var(--mkt-bg-canvas)',
          surface:  'var(--mkt-bg-surface)',
          deep:     'var(--mkt-bg-deep)',
          'deep-2': 'var(--mkt-bg-deep-2)',
          /* Ink */
          ink: {
            primary:   'var(--mkt-ink-primary)',
            secondary: 'var(--mkt-ink-secondary)',
            tertiary:  'var(--mkt-ink-tertiary)',
            inverse:   'var(--mkt-ink-inverse)',
          },
          /* Hairlines */
          line:        'var(--mkt-line)',
          'line-dark': 'var(--mkt-line-dark)',
          /* Accent + signal — use sparingly per design-system rules */
          accent:    'var(--mkt-accent)',     /* antique gold */
          positive:  'var(--mkt-positive)',   /* up-move green */
          negative:  'var(--mkt-negative)',   /* down-move red */
        },
        /* ─────────────────────────────────────────────────────────
           Textura landing theme (`tx.*` namespace) — ported from
           next16-claude-starter. CSS-variable references resolving
           to values in `src/styles/textura.css`, scoped under
           `[data-textura]` on the (landing) layout wrapper.
           Monochrome by design: no brand accent color.
           ───────────────────────────────────────────────────────── */
        tx: {
          bg:        'rgb(var(--tx-background) / <alpha-value>)',
          ink:       'rgb(var(--tx-foreground) / <alpha-value>)',
          strong:    'rgb(var(--tx-ink-strong) / <alpha-value>)',
          muted:     'rgb(var(--tx-muted) / <alpha-value>)',
          faint:     'rgb(var(--tx-faint) / <alpha-value>)',
          surface:   {
            DEFAULT: 'rgb(var(--tx-surface) / <alpha-value>)',
            deep:    'rgb(var(--tx-surface-deep) / <alpha-value>)',
          },
          /* hairline: foreground at 10% — use border-tx-line (alpha baked in) */
          line:      'rgb(var(--tx-foreground) / 0.1)',
          inverse:   {
            DEFAULT: 'rgb(var(--tx-inverse) / <alpha-value>)',
            ink:     'rgb(var(--tx-inverse-foreground) / <alpha-value>)',
          },
        },
        /* ─────────────────────────────────────────────────────────
           Crextio warm dashboard theme (`crx.*`) — CSS-variable refs
           resolving to values in `src/styles/crextio.css`, scoped
           under `.theme-warm` on the DashboardShell wrapper.
           ───────────────────────────────────────────────────────── */
        crx: {
          charcoal: {
            DEFAULT: 'var(--crx-charcoal)',
            hover:   'var(--crx-charcoal-hover)',
            ink:     'var(--crx-charcoal-ink)',
          },
          yellow: {
            DEFAULT: 'var(--crx-yellow)',
            soft:    'var(--crx-yellow-soft)',
          },
          pill: 'var(--crx-pill)',
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #F58A60 0%, #E94E1B 50%, #C73E11 100%)',
        'gradient-hero': 'linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 50%, #F5F5F5 100%)',
        'gradient-section': 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)',
        'gradient-section-alt': 'linear-gradient(180deg, #FAFAFA 0%, #FFFFFF 100%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // `mono` now renders the numeric font (Space Grotesk, solid
        // ValutaSolid-style) so every existing `font-mono tabular-nums`
        // balance / price / P&L picks it up app-wide. JetBrains Mono
        // stays as the fallback for any true monospace context.
        mono: ['var(--font-numeric)', 'JetBrains Mono', 'Menlo', 'monospace'],
        // ── Marketing-design-system fonts (next/font CSS vars) ───────
        display: ['var(--font-display)', 'Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        numeric: ['var(--font-numeric)', 'Space Grotesk', 'Menlo', 'monospace'],
        // Textura landing theme font (next16-claude-starter port)
        onest: ['var(--font-onest)', 'Onest', 'Inter', 'system-ui', 'sans-serif'],
        // Crextio dashboard theme font (Nixtio reference)
        crextio: ['var(--font-crextio)', 'Poppins', 'Inter', 'system-ui', 'sans-serif'],
        editorial: ['var(--font-editorial)', 'Instrument Serif', 'Georgia', 'serif'],
      },
      transitionTimingFunction: {
        // Starter's entrance ease (globals.css --ease-entrance)
        entrance: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
      },
      fontSize: {
        'xxs': ['10px', { lineHeight: '14px' }],
        'xs': ['11px', { lineHeight: '16px' }],
        'sm': ['12px', { lineHeight: '16px' }],
        'base': ['13px', { lineHeight: '20px' }],
        'md': ['14px', { lineHeight: '20px' }],
        'lg': ['16px', { lineHeight: '24px' }],
        'xl': ['20px', { lineHeight: '28px' }],
        '2xl': ['28px', { lineHeight: '36px' }],
        '3xl': ['36px', { lineHeight: '44px' }],
        // ── Marketing display scale (per design-system brief) ───────
        // Use the responsive pair on H1/H2: e.g.
        //   <h1 className="text-display-h1-sm md:text-display-h1">
        'display-h1-sm':  ['40px', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'display-h1':     ['72px', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'display-h2-sm':  ['32px', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        'display-h2':     ['52px', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        'display-h3':     ['22px', { lineHeight: '1.25' }],
        'display-h3-lg':  ['28px', { lineHeight: '1.22' }],
        'body-lg':        ['17px', { lineHeight: '1.55' }],
        'body-md':        ['15px', { lineHeight: '1.6' }],
        'caption':        ['12px', { lineHeight: '1.4', letterSpacing: '0.08em' }],
      },
      letterSpacing: {
        'caption':        '0.08em',
        'wordmark':       '0.18em',
        'display-tight':  '-0.03em',
        'display-snug':   '-0.025em',
      },
      maxWidth: {
        'container':      '1280px',
      },
      /* `boxShadow` is declared ONCE below at the bottom of `extend`.
         A prior version of this file had two `boxShadow:` blocks —
         the second silently overrode the first, dropping the `nav`
         stroke. The two are now merged at the bottom block. */
      borderRadius: { sm: '4px', DEFAULT: '4px', md: '6px', lg: '8px', xl: '12px', '2xl': '16px', '3xl': '24px' },
      spacing: {
        '0.5': '2px', '1': '4px', '1.5': '6px', '2': '8px', '3': '12px',
        '4': '16px', '5': '20px', '6': '24px', '8': '32px', '10': '40px',
        '12': '48px',
        // Marketing-section vertical rhythm (per brief: 64px mobile / 96px desktop)
        'section-y-mobile':   '64px',
        'section-y-desktop':  '96px',
        'gutter':             '24px',
      },
      backdropBlur: { xs: '2px', glass: '16px', 'glass-heavy': '24px', 'glass-ultra': '40px' },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'flash-blue': 'flashBlue 0.15s ease-out',
        'flash-red': 'flashRed 0.15s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        /** Wallet deposit/withdraw — Crucial-style neon tab + panel */
        'wallet-neon-tab': 'walletNeonTabGlow 2.6s ease-in-out infinite',
        'wallet-main-tab-glow': 'walletMainTabGlow 2.2s ease-in-out infinite',
        'wallet-main-tab-text': 'walletMainTabText 0.55s cubic-bezier(0.34, 1.45, 0.64, 1) both',
        'wallet-fund-enter': 'walletFundEnter 0.48s cubic-bezier(0.22, 1, 0.36, 1) both',
        'wallet-fund-enter-lg': 'walletFundEnterLg 0.65s cubic-bezier(0.22, 1, 0.36, 1) both',
        'wallet-sub-pill': 'walletSubPill 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        /** Open-Account drawer — staggered card entrance + selection tick */
        'drawer-card': 'drawerCard 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'drawer-section': 'drawerSection 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'check-pop': 'checkPop 0.3s cubic-bezier(0.34, 1.45, 0.64, 1) both',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        drawerCard: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        drawerSection: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        checkPop: {
          '0%': { opacity: '0', transform: 'scale(0.4)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        flashBlue: { '0%': { backgroundColor: 'rgba(41,98,255,0.22)' }, '100%': { backgroundColor: 'transparent' } },
        flashRed: { '0%': { backgroundColor: 'rgba(239,68,68,0.2)' }, '100%': { backgroundColor: 'transparent' } },
        glowPulse: { '0%, 100%': { boxShadow: '0 0 20px rgba(99,102,241,0.18)' }, '50%': { boxShadow: '0 0 40px rgba(99,102,241,0.32)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        walletNeonTabGlow: {
          '0%, 100%': {
            boxShadow:
              '0 -1px 20px rgba(99, 102, 241, 0.22), 0 0 32px rgba(99, 102, 241, 0.12), inset 0 0 24px rgba(99, 102, 241, 0.04)',
          },
          '50%': {
            boxShadow:
              '0 -1px 36px rgba(99, 102, 241, 0.45), 0 0 52px rgba(99, 102, 241, 0.22), inset 0 0 32px rgba(99, 102, 241, 0.08)',
          },
        },
        /** Deposit / Withdraw main tabs — stronger pulsing glow */
        walletMainTabGlow: {
          '0%, 100%': {
            boxShadow:
              '0 -6px 40px rgba(99, 102, 241, 0.38), 0 0 56px rgba(99, 102, 241, 0.2), inset 0 1px 0 rgba(99, 102, 241, 0.14)',
          },
          '50%': {
            boxShadow:
              '0 -10px 64px rgba(99, 102, 241, 0.62), 0 0 88px rgba(99, 102, 241, 0.32), inset 0 1px 0 rgba(99, 102, 241, 0.22)',
          },
        },
        walletMainTabText: {
          '0%': { opacity: '0.5', transform: 'scale(0.92) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        walletFundEnter: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        walletFundEnterLg: {
          '0%': { opacity: '0', transform: 'translateY(22px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        walletSubPill: {
          '0%': { opacity: '0.85', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      /* All elevation tokens live HERE. Previously two `boxShadow:`
         blocks coexisted — the second one overrode the first, which
         silently dropped the marketing `nav` shadow. Merged. */
      boxShadow: {
        /* ── Marketing design system — sticky nav stroke only ─────
           Per the brief: hairlines, not shadows. The only allowed
           elevation is this 1px-deep stroke on the sticky navigation. */
        'mkt-nav':       '0 1px 0 rgba(11, 27, 51, 0.04)',
        /* Legacy `nav` alias kept for any code that already references it. */
        'nav':           '0 1px 0 rgba(11, 27, 51, 0.04)',

        /* ── Trader app legacy shadows ──────────────────────────── */
        'modal':         '0 8px 32px rgba(0,0,0,0.6)',
        'dropdown':      '0 4px 16px rgba(0,0,0,0.4)',
        'glass':         '0 8px 32px 0 rgba(0,0,0,0.37)',
        'glass-sm':      '0 4px 16px 0 rgba(0,0,0,0.25)',
        'glass-lg':      '0 16px 48px 0 rgba(0,0,0,0.5)',
        'inner-light':   'inset 0 1px 0 0 rgba(255,255,255,0.05)',
        'skeu':          'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.3)',
        'glow-blue':     '0 0 20px rgba(41,98,255,0.28), 0 0 60px rgba(41,98,255,0.1)',
        'glow-red':      '0 0 20px rgba(239,68,68,0.3), 0 0 60px rgba(239,68,68,0.1)',
        'neon-green-sm': '0 0 20px rgba(99, 102, 241, 0.25), 0 0 48px rgba(99, 102, 241, 0.08)',
        'neon-green-lg': '0 0 28px rgba(99, 102, 241, 0.4), 0 0 64px rgba(99, 102, 241, 0.15)',
      },
    },
  },
  plugins: [],
}

export default config
