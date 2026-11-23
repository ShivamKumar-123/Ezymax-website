/**
 * Small illustrated "AI character" avatars, drawn inline as SVG so they need
 * no image files and stay crisp at any size. Used wherever the reference
 * design had an empty avatar circle (quote attributions, trust stacks, the
 * safety avatar row and the contact channel list).
 *
 * Keeps the `img-ph avatar` classes so the existing sizing, stacking borders
 * and the pop-in animation in init.ts keep working unchanged.
 */

type Size = 'md' | 'sm' | 'xs';

type Props = {
  /** Picks the palette and face; any integer, wraps around the set. */
  variant?: number;
  size?: Size;
  className?: string;
};

type Look = {
  bg: [string, string];
  skin: string;
  accent: string;
  eyes: 'dots' | 'visor' | 'happy' | 'wide';
  top: 'antenna' | 'ears' | 'halo' | 'none';
};

const LOOKS: Look[] = [
  { bg: ['#6D8CFF', '#3B5BDB'], skin: '#F4F6FF', accent: '#1E2A78', eyes: 'dots', top: 'antenna' },
  { bg: ['#FF8A65', '#E64A19'], skin: '#FFF4EE', accent: '#7A2A0B', eyes: 'happy', top: 'ears' },
  { bg: ['#4DD0C4', '#0F9D8F'], skin: '#EEFFFC', accent: '#0B4F49', eyes: 'visor', top: 'antenna' },
  { bg: ['#B388FF', '#7C4DFF'], skin: '#F7F2FF', accent: '#3A1E8C', eyes: 'wide', top: 'halo' },
  { bg: ['#FFD54F', '#F9A825'], skin: '#FFFBEA', accent: '#6B4A00', eyes: 'dots', top: 'ears' },
  { bg: ['#F48FB1', '#D81B60'], skin: '#FFF0F6', accent: '#7A0F3A', eyes: 'happy', top: 'antenna' },
  { bg: ['#81C784', '#2E7D32'], skin: '#F0FFF1', accent: '#12401A', eyes: 'visor', top: 'none' },
  { bg: ['#90A4AE', '#455A64'], skin: '#F3F6F8', accent: '#1F2A30', eyes: 'wide', top: 'antenna' },
];

function Eyes({ kind, accent }: { kind: Look['eyes']; accent: string }) {
  switch (kind) {
    case 'visor':
      return <rect x="20" y="26" width="24" height="9" rx="4.5" fill={accent} />;
    case 'happy':
      return (
        <g fill="none" stroke={accent} strokeWidth="2.6" strokeLinecap="round">
          <path d="M23 31 q3.5 -4 7 0" />
          <path d="M34 31 q3.5 -4 7 0" />
        </g>
      );
    case 'wide':
      return (
        <g fill={accent}>
          <ellipse cx="26" cy="30" rx="3.4" ry="4.2" />
          <ellipse cx="38" cy="30" rx="3.4" ry="4.2" />
          <circle cx="27" cy="28.6" r="1" fill="#fff" />
          <circle cx="39" cy="28.6" r="1" fill="#fff" />
        </g>
      );
    default:
      return (
        <g fill={accent}>
          <circle cx="26" cy="30" r="2.8" />
          <circle cx="38" cy="30" r="2.8" />
        </g>
      );
  }
}

function Top({ kind, accent, skin }: { kind: Look['top']; accent: string; skin: string }) {
  switch (kind) {
    case 'antenna':
      return (
        <g>
          <rect x="30.8" y="9" width="2.4" height="7" rx="1.2" fill={accent} />
          <circle cx="32" cy="8" r="2.6" fill={skin} stroke={accent} strokeWidth="1.6" />
        </g>
      );
    case 'ears':
      return (
        <g fill={skin} stroke={accent} strokeWidth="1.6">
          <rect x="13" y="26" width="5" height="10" rx="2.5" />
          <rect x="46" y="26" width="5" height="10" rx="2.5" />
        </g>
      );
    case 'halo':
      return <ellipse cx="32" cy="12" rx="11" ry="3.2" fill="none" stroke={skin} strokeWidth="2" opacity="0.9" />;
    default:
      return null;
  }
}

export function AiAvatar({ variant = 0, size = 'md', className = '' }: Props) {
  const look = LOOKS[((variant % LOOKS.length) + LOOKS.length) % LOOKS.length];
  const id = `nxav-${((variant % LOOKS.length) + LOOKS.length) % LOOKS.length}`;
  const sizeClass = size === 'md' ? '' : size;
  return (
    <span className={`img-ph avatar ai-av ${sizeClass} ${className}`.trim()} data-label="" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="100%" height="100%" role="img" focusable="false">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={look.bg[0]} />
            <stop offset="1" stopColor={look.bg[1]} />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill={`url(#${id})`} />
        <Top kind={look.top} accent={look.accent} skin={look.skin} />
        {/* Head */}
        <rect x="16" y="16" width="32" height="30" rx="12" fill={look.skin} />
        {/* Face plate */}
        <rect x="19.5" y="21" width="25" height="19" rx="9" fill="#fff" opacity="0.55" />
        <Eyes kind={look.eyes} accent={look.accent} />
        {/* Mouth */}
        {look.eyes === 'visor' ? (
          <rect x="27" y="39" width="10" height="2.2" rx="1.1" fill={look.accent} opacity="0.8" />
        ) : (
          <path d="M27 38.5 q5 4 10 0" fill="none" stroke={look.accent} strokeWidth="2.2" strokeLinecap="round" />
        )}
        {/* Shoulders */}
        <path d="M12 64 q4 -16 20 -16 q16 0 20 16 z" fill={look.skin} opacity="0.95" />
        <rect x="27" y="46" width="10" height="6" rx="2" fill={look.skin} />
      </svg>
    </span>
  );
}

export default AiAvatar;
