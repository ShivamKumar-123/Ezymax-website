'use client'

/**
 * Icons3d — glossy "3D gold" icon set for the landing pages.
 * Each icon is a self-contained SVG with layered gold gradients, a specular
 * top highlight and a soft drop shadow, so it reads as a polished 3D object
 * instead of a flat line glyph. Render with <Icon3D name="wallet" size={46} />.
 *
 * Available names: wallet, profile, dashboard, allocate, trading, coins, withdraw
 */

function IconShell({ name, size = 46, children }) {
  const gId = `fx3d-g-${name}`
  const gdId = `fx3d-gd-${name}`
  const ghId = `fx3d-gh-${name}`
  const shId = `fx3d-sh-${name}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        {/* main gold body: light top-left → deep gold bottom-right */}
        <linearGradient id={gId} x1="14" y1="8" x2="50" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fdeeb0" />
          <stop offset="0.42" stopColor="#ecc657" />
          <stop offset="1" stopColor="#a9781f" />
        </linearGradient>
        {/* darker gold for backs / recessed faces */}
        <linearGradient id={gdId} x1="32" y1="8" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c99a34" />
          <stop offset="1" stopColor="#7c561a" />
        </linearGradient>
        {/* specular highlight on the top */}
        <linearGradient id={ghId} x1="32" y1="6" x2="32" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* depth shadow + subtle gold ambient glow */}
        <filter id={shId} x="-40%" y="-35%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2.4" stdDeviation="1.8" floodColor="#3a2708" floodOpacity="0.55" />
          <feDropShadow dx="0" dy="0" stdDeviation="3.2" floodColor="#ecc657" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter={`url(#${shId})`}>
        {children({ g: `url(#${gId})`, gd: `url(#${gdId})`, gh: `url(#${ghId})` })}
      </g>
    </svg>
  )
}

/* ── Individual glyphs ─────────────────────────────────────────────────── */

function Wallet(p) {
  return (
    <IconShell name="wallet" {...p}>
      {({ g, gd, gh }) => (
        <>
          <rect x="9" y="16" width="46" height="34" rx="9" fill={gd} />
          <rect x="9" y="23" width="46" height="27" rx="8" fill={g} />
          <path d="M17 23h30a8 8 0 0 1 8 8v0H9v0a8 8 0 0 1 8-8Z" fill={gh} opacity="0.5" />
          <circle cx="45" cy="36" r="5.5" fill={gd} />
          <circle cx="45" cy="36" r="2.4" fill="#fdeeb0" />
        </>
      )}
    </IconShell>
  )
}

function Profile(p) {
  return (
    <IconShell name="profile" {...p}>
      {({ g, gd, gh }) => (
        <>
          <path d="M11 52c0-11 8.6-17 19-17s19 6 19 17v1H11v-1Z" fill={g} />
          <circle cx="30" cy="21" r="11" fill={g} />
          <ellipse cx="30" cy="15" rx="7" ry="4" fill={gh} opacity="0.55" />
          <circle cx="47" cy="45" r="10" fill={gd} />
          <path d="M42.5 45.5l3.2 3.2 5.8-6" stroke="#fdeeb0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </IconShell>
  )
}

function Dashboard(p) {
  return (
    <IconShell name="dashboard" {...p}>
      {({ g, gh }) => (
        <>
          {[
            [12, 12],
            [34, 12],
            [12, 34],
            [34, 34],
          ].map(([x, y], i) => (
            <g key={i}>
              <rect x={x} y={y} width="18" height="18" rx="5" fill={g} />
              <rect x={x + 2.5} y={y + 2.5} width="13" height="6" rx="3" fill={gh} opacity="0.5" />
            </g>
          ))}
        </>
      )}
    </IconShell>
  )
}

function Allocate(p) {
  return (
    <IconShell name="allocate" {...p}>
      {({ g, gd, gh }) => (
        <>
          <rect x="27" y="10" width="10" height="24" rx="5" fill={g} />
          <path d="M32 44 18 30h28L32 44Z" fill={g} />
          <path d="M32 40 24 32h16l-8 8Z" fill={gh} opacity="0.45" />
          <rect x="14" y="48" width="36" height="7" rx="3.5" fill={gd} />
        </>
      )}
    </IconShell>
  )
}

function Trading(p) {
  return (
    <IconShell name="trading" {...p}>
      {({ g, gd, gh }) => (
        <>
          <rect x="12" y="48" width="40" height="6" rx="3" fill={gd} />
          <rect x="14" y="34" width="9" height="16" rx="3.5" fill={g} />
          <rect x="27.5" y="24" width="9" height="26" rx="3.5" fill={g} />
          <rect x="41" y="14" width="9" height="36" rx="3.5" fill={g} />
          <rect x="15.5" y="36" width="6" height="5" rx="2.5" fill={gh} opacity="0.5" />
          <rect x="29" y="26" width="6" height="5" rx="2.5" fill={gh} opacity="0.5" />
          <rect x="42.5" y="16" width="6" height="5" rx="2.5" fill={gh} opacity="0.5" />
        </>
      )}
    </IconShell>
  )
}

function Coins(p) {
  return (
    <IconShell name="coins" {...p}>
      {({ g, gd, gh }) => (
        <>
          {[46, 38, 30].map((cy, i) => (
            <g key={i}>
              <ellipse cx="32" cy={cy + 3} rx="17" ry="6.5" fill={gd} />
              <ellipse cx="32" cy={cy} rx="17" ry="6.5" fill={g} />
              <ellipse cx="27" cy={cy - 1.5} rx="7" ry="2.4" fill={gh} opacity="0.5" />
            </g>
          ))}
        </>
      )}
    </IconShell>
  )
}

function Withdraw(p) {
  return (
    <IconShell name="withdraw" {...p}>
      {({ g, gd, gh }) => (
        <>
          <rect x="14" y="10" width="36" height="7" rx="3.5" fill={gd} />
          <rect x="27" y="30" width="10" height="24" rx="5" fill={g} />
          <path d="M32 20 46 34H18L32 20Z" fill={g} />
          <path d="M32 25 40 33H24l8-8Z" fill={gh} opacity="0.5" />
        </>
      )}
    </IconShell>
  )
}

const ICONS = {
  wallet: Wallet,
  profile: Profile,
  dashboard: Dashboard,
  allocate: Allocate,
  trading: Trading,
  coins: Coins,
  withdraw: Withdraw,
}

export default function Icon3D({ name, size = 46 }) {
  const Cmp = ICONS[name]
  if (!Cmp) return null
  return <Cmp size={size} />
}
