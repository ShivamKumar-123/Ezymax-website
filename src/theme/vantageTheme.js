import { Platform } from 'react-native';

export const vantage = {
  // Surfaces — lifted off pure black so cards stand out against the
  // black→orange gradient background.
  bg:           '#000000',
  bgElevated:   '#242424',
  bgRaised:     '#2E2E2E',
  bgPressed:    '#383838',
  border:       '#303030',
  borderStrong: '#424242',

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

  // Trade-screen specific — Sell uses the reference red/pink.
  sellBg:       '#EF4565',
  buyBg:        '#2E2E2E',
  spreadChip:   '#000000',

  // Sell/Buy action buttons — vibrant Vantage-style red & green. The dim
  // variants color the unselected side so both stay readable as red/green.
  sellBtn:      '#FF3B5C',
  sellBtnDim:   'rgba(255,59,92,0.30)',
  buyBtn:       '#16C784',
  buyBtnDim:    'rgba(22,199,132,0.30)',
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
  hero:  28,
  h1:    22,
  h2:    18,
  h3:    15,
  body:  14,
  label: 12,
  micro: 10,
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
