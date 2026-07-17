/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F4F6F9",
        surface: "#FFFFFF",
        ink: "#1E293B",
        "ink-soft": "#64748B",
        border: "#E2E8F0",
        navy: "#1A3C5E",
        "navy-dark": "#0F2540",
        "navy-light": "#2A5480",
        gold: "#E8A020",
        "gold-light": "#FFE066",
        good: "#16A34A",
        "good-soft": "#DCFCE7",
        warn: "#D97706",
        "warn-soft": "#FEF3C7",
        danger: "#DC2626",
        "danger-soft": "#FEE2E2",
      },
      fontFamily: {
        display: ["var(--font-jakarta)", "sans-serif"],
        body: ["var(--font-jakarta)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "10px",
        lg: "14px",
        xl: "18px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,37,64,0.04), 0 1px 8px rgba(15,37,64,0.06)",
      },
    },
  },
  plugins: [],
};
