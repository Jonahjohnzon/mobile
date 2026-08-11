/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Same dark family as the web app, re-cut around a cinema-marquee
        // idea instead of a flat near-black. `bg` has a faint blue-cool
        // cast so surfaces have somewhere to sit above it.
        bg: '#0B0D10',
        surface: '#15181C',
        surfaceRaised: '#1E2227',
        line: '#262B31',
        ink: '#F5F3EE',
        inkMuted: '#8B9096',
        inkFaint: '#575D64',
        // Marquee-bulb amber is the one accent color, used sparingly:
        // active nav state, section markers, rating chip, rank badges.
        marquee: '#F2B705',
        marqueeDim: '#8A6B12',
        // Ticket-stub red-orange, used only for the hero CTA + trailer badge.
        ticket: '#E4572E',
      },
      fontFamily: {
        display: ['BebasNeue_400Regular'],
        body: ['Inter_400Regular'],
        bodyMedium: ['Inter_500Medium'],
        bodySemibold: ['Inter_600SemiBold'],
        mono: ['JetBrainsMono_500Medium'],
      },
    },
  },
  plugins: [],
};
