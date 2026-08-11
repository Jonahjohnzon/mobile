// Mirrors tailwind.config.js. Kept in JS too because a handful of RN APIs
// (icon `color` props, the React Navigation theme, StatusBar) need a raw
// hex string and can't consume a className.
export const colors = {
  bg: '#0B0D10',
  surface: '#15181C',
  surfaceRaised: '#1E2227',
  line: '#262B31',
  ink: '#F5F3EE',
  inkMuted: '#8B9096',
  inkFaint: '#575D64',
  marquee: '#F2B705',
  marqueeDim: '#8A6B12',
  ticket: '#E4572E',
};

export const navTheme = {
  dark: true,
  colors: {
    primary: colors.marquee,
    background: colors.bg,
    card: colors.surface,
    text: colors.ink,
    border: colors.line,
    notification: colors.ticket,
  },
  fonts: {
    regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
    medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' },
    bold: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
    heavy: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  },
};
