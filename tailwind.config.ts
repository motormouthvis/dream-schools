import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dream Neighborhood green
        brand: {
          50: "#eefbf2",
          100: "#d6f5e0",
          200: "#b0eac6",
          300: "#7dd9a4",
          400: "#46c07c",
          500: "#1fa55f",
          600: "#12854c",
          700: "#0f6a3f",
          800: "#105435",
          900: "#0e3d28",
        },
        // bright lime accent (primary CTAs)
        lime2: {
          400: "#a5e635",
          500: "#84cc16",
          600: "#65a30d",
        },
        ink: {
          800: "#13241b",
          900: "#0c1a13",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
