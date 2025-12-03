/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  // Ensure these utility classes are not purged by Tailwind JIT
  safelist: [
    'bg-blue-50','border-blue-600','text-blue-800','bg-blue-100','text-blue-700',
    'bg-pink-50','border-pink-600','text-pink-800','bg-pink-100','text-pink-700',
    'bg-gray-100','border-gray-400','text-gray-800','bg-gray-50',
  ],
  plugins: [],
}