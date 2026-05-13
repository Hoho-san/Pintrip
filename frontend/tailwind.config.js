/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Nexus Design System — Hydra Teal primary
        primary: {
          DEFAULT: '#01696f',
          hover:   '#0c4e54',
          active:  '#0f3638',
          light:   '#cedcd8',
        },
        surface: {
          bg:      '#f7f6f2',
          DEFAULT: '#f9f8f5',
          2:       '#fbfbf9',
          offset:  '#f3f0ec',
        },
        border: '#d4d1ca',
        text: {
          DEFAULT: '#28251d',
          muted:   '#7a7974',
          faint:   '#bab9b4',
        },
      },
      fontFamily: {
        display: ['Instrument Serif', 'Georgia', 'serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm:   '0.375rem',
        md:   '0.5rem',
        lg:   '0.75rem',
        xl:   '1rem',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px oklch(0.2 0.01 80 / 0.06)',
        md: '0 4px 12px oklch(0.2 0.01 80 / 0.08)',
        lg: '0 12px 32px oklch(0.2 0.01 80 / 0.12)',
      },
    },
  },
  plugins: [],
}
