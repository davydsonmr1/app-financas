import { useColorScheme } from 'react-native';

const light = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  border: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
  primary: '#6366f1',
  onPrimary: '#ffffff',
  positive: '#16a34a',
  negative: '#dc2626',
  invest: '#0284c7',
  warn: '#d97706',
};

const dark: typeof light = {
  bg: '#0b1120',
  surface: '#141d2f',
  surfaceAlt: '#1c2740',
  border: '#26334d',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  primary: '#818cf8',
  onPrimary: '#0b1120',
  positive: '#4ade80',
  negative: '#f87171',
  invest: '#38bdf8',
  warn: '#fbbf24',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
