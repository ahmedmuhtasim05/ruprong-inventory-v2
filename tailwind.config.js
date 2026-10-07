/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-light': 'var(--primary-light)',
        'primary-dark': 'var(--primary-dark)',
        gold: 'var(--primary)',
        'gold-light': 'var(--primary-light)',
        'gold-dark': 'var(--primary-dark)',
      },
    },
  },
  plugins: [],
};
