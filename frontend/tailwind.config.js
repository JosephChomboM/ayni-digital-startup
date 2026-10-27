/** @type {import("tailwindcss").Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ayni: {
          green: "#0D7A5F",
          darkGreen: "#0A634D",
          lightBg: "#F4FBF7",
          softGreen: "#E8F5E9",
        }
      }
    },
  },
  plugins: [],
}

