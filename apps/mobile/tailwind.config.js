/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/app/**/*.{js,jsx,ts,tsx}', './src/components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0D0F0E',
        surface: '#191C1A',
        'surface-2': '#232723',
        elevated: '#292E29',
        border: '#313731',
        divider: '#292F29',
        brand: '#C9BA91',
        'brand-on': '#171913',
        'brand-subtle': '#373628',
        primary: '#EFF0E9',
        secondary: '#A2A99F',
        muted: '#787F77',
        positive: '#90AD98',
        warning: '#D9A66F',
        negative: '#CF837B',
        neutral: '#8B948C',
      },
      borderRadius: { card: '18px' },
      spacing: { screen: '16px' },
    },
  },
  plugins: [],
};
