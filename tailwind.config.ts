import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        "bg-2": "rgb(var(--bg-2) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        line: "rgb(var(--border) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-fg": "rgb(var(--primary-fg) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        sakura: "rgb(var(--sakura) / <alpha-value>)",
      },
      fontFamily: {
        display: ['"Zen Maru Gothic"', "sans-serif"],
        sans: ['"Zen Kaku Gothic Antique"', "system-ui", "sans-serif"],
      },
      letterSpacing: { kana: "0.35em" },
      borderRadius: { xl: "0.75rem", "2xl": "1.1rem" },
      boxShadow: {
        glow: "0 0 60px -12px rgb(var(--primary) / 0.55)",
        card: "0 18px 40px -18px rgb(0 0 0 / 0.8)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "ken-burns": {
          from: { transform: "scale(1.05) translate(0, 0)" },
          to: { transform: "scale(1.18) translate(-2%, -1%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "slide-up": "slide-up 0.5s ease-out both",
        "ken-burns": "ken-burns 20s ease-out alternate infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
