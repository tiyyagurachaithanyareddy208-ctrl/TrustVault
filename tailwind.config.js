/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          950: '#070B14',
          900: '#0B132B',
          850: '#0F1A3A',
          800: '#14224A',
          700: '#1C2E60',
          600: '#284080',
          card: '#101B36',
          border: '#1E2F54',
          hover: '#19284D',
          accent: '#00E5FF',
          accentDark: '#0284C7',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#F43F5E',
        },
      },
    },
  },
  plugins: [],
};
