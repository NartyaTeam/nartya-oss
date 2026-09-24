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
        chevron: { "0%, 75%, 100%": { opacity: "0.2" }, "38%": { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: { to: { transform: "translateX(100%)" } },
        "pop-in": {
          from: { opacity: "0", transform: "scale(0.96) translateY(-4px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.6s ease both",
        chevron: "chevron 0.9s infinite",
        "slide-up": "slide-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s infinite",
        "pop-in": "pop-in 0.14s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
