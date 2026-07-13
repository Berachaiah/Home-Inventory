/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FAF9F5",
        surface: "#FFFFFF",
        ink: "#1C1F1B",
        "ink-soft": "#5C6660",
        line: "#E2DED4",
        accent: "#2F5D50",
        "accent-soft": "#E4EDE9",
        low: "#B5651D",
        out: "#A63D40",
        warn: "#C08A2E",
        good: "#2F5D50",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};
