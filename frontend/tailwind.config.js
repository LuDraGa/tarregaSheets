/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3B82F6',
          dark: '#1E40AF',
          light: '#60A5FA',
        },
        secondary: {
          DEFAULT: '#8B5CF6',
          dark: '#6D28D9',
          light: '#A78BFA',
        },
      },
    },
  },
  plugins: [],
}
