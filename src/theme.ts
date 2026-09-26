import { StyleSheet, type ViewStyle } from 'react-native';

/** Semantic color tokens. Screens never use raw hex values, so both themes stay consistent. */
export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  primary: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  me: string;
  partner: string;
  tabBar: string;
  tabActive: string;
  tabIcon: string;
  tabActiveIcon: string;
  heroGradient: readonly [string, string, string];
  coupleGradient: readonly [string, string];
  onHero: string;
}

/** Avatar colors per member, in join order: you, then the partner, then the rest of a family. */
export const memberPalette = (c: ThemeColors) => [c.me, c.partner, '#F59F00', '#12B886', '#8B5CF6', '#06B6D4', '#E8590C'];

const light: ThemeColors = {
  bg: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F6',
  text: '#0A1433',
  textMuted: '#5B6475',
  textSubtle: '#8C94A3',
  border: '#E4E8EF',
  primary: '#0A1F5C',
  onPrimary: '#FFFFFF',
  accent: '#0070E0',
  accentSoft: '#E6F0FC',
  success: '#0B8A4B',
  successSoft: '#E2F4EA',
  danger: '#D92D20',
  dangerSoft: '#FDECEA',
  me: '#2F7BF5',
  partner: '#FF5C8A',
  tabBar: '#0A1F5C',
  tabActive: '#FFFFFF',
  tabIcon: 'rgba(255,255,255,0.62)',
  tabActiveIcon: '#0A1F5C',
  heroGradient: ['#001C64', '#003087', '#0070E0'],
  coupleGradient: ['#FFE3EC', '#E6F0FC'],
  onHero: '#FFFFFF',
};

const dark: ThemeColors = {
  bg: '#090C13',
  surface: '#131824',
  surfaceAlt: '#1B2130',
  text: '#F3F5F9',
  textMuted: '#A3ABBA',
  textSubtle: '#6E7788',
  border: '#232A39',
  primary: '#F3F5F9',
  onPrimary: '#090C13',
  accent: '#5AA2FF',
  accentSoft: '#132749',
  success: '#34C77B',
  successSoft: '#0F2A1D',
  danger: '#FF6B5E',
  dangerSoft: '#341619',
  me: '#4C8DFF',
  partner: '#FF6F98',
  tabBar: '#1B2130',
  tabActive: '#F3F5F9',
  tabIcon: '#7E8798',
  tabActiveIcon: '#090C13',
  heroGradient: ['#0A1E5E', '#0B3FA8', '#1C7BFF'],
  coupleGradient: ['#2A1422', '#132749'],
  onHero: '#FFFFFF',
};

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
  /** Elevation for cards: soft shadow in light mode, hairline border in dark mode. */
  elevation: ViewStyle;
}

// `boxShadow` renders the same soft shadow on iOS, Android (new architecture) and web. Android's
// `elevation` drew grey, square-looking edges around rounded cards.
const lightShadow: ViewStyle = { boxShadow: '0px 1px 2px rgba(10, 20, 51, 0.05), 0px 6px 18px rgba(10, 20, 51, 0.07)' };

export const lightTheme: Theme = { dark: false, colors: light, elevation: lightShadow };
export const darkTheme: Theme = {
  dark: true,
  colors: dark,
  elevation: { borderWidth: StyleSheet.hairlineWidth, borderColor: dark.border },
};

export const radius = { sm: 12, md: 20, lg: 28, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 40, letterSpacing: -1.2 },
  h1: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15 },
  small: { fontFamily: fonts.medium, fontSize: 13 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 13 },
  tiny: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.4 },
};

export const GOAL_COLORS = ['#2F7BF5', '#FF5C8A', '#12B886', '#FF9F1C', '#7B61FF', '#00B3D6'];
