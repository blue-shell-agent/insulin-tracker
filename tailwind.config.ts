import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: { 50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac", 400: "#4ade80", 500: "#16a34a", 600: "#15803d", 700: "#166534", 800: "#14532d", 900: "#052e16" },
      },
    },
  },
  plugins: [],
};
export default config;
