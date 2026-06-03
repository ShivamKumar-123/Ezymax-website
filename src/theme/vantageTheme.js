import { Platform } from 'react-native';

export const vantage = {
  // Surfaces
  bg:           '#000000',
  bgElevated:   '#0F0F0F',
  bgRaised:     '#161616',
  bgPressed:    '#1F1F1F',
  border:       '#1F1F1F',
  borderStrong: '#2A2A2A',

  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted:     '#6B7280',
  textInverse:   '#000000',

  // Brand
  accent:       '#F26A1F',
  accentGlow:   '#FF8A3D',
  accentMuted:  'rgba(242,106,31,0.12)',

  // Directionals
  up:           '#22C55E',
  upMuted:      'rgba(34,197,94,0.10)',
  down:         '#EF4565',
  downMuted:    'rgba(239,69,101,0.10)',

  // Trade-screen specific
  sellBg:       '#EF4565',
  buyBg:        '#1F1F1F',
  spreadChip:   '#000000',
};

export const fontFamily = Platform.select({ ios: 'System', android: 'Roboto' });

export const weights = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  heavy:    '800',
};

export const sizes = {
  hero:  32,
  h1:    24,
  h2:    20,
  h3:    17,
  body:  15,
  label: 13,
  micro: 11,
};

export const space = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  huge: 48,
};

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  pill: 999,
};

export default {
  vantage,
  fontFamily,
  weights,
  sizes,
  space,
  radius,
};
