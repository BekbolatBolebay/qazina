import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        qazina: {
          warm: "#F8F5EF",
          ink: "#242424",
          green: "#173F35",
          "green-hover": "#112F28",
          gold: "#B58B54",
          "gold-soft": "#D4B382",
          card: "#FFFFFF",
          beige: "#EFE8DD",
          "dark-bg": "#141917",
          "dark-card": "#1D2421",
          "dark-beige": "#26302C",
          "dark-ink": "#F3EFE7",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "Noto Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Noto Serif", "Georgia", "serif"],
      },
      boxShadow: {
        literary: "0 10px 30px -10px rgba(23, 63, 53, 0.08)",
        card: "0 4px 20px rgba(36, 36, 36, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
