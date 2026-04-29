export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{vue,js}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--dt-bg) / <alpha-value>)",
        surface: "rgb(var(--dt-surface) / <alpha-value>)",
        surface2: "rgb(var(--dt-surface2) / <alpha-value>)",
        text: "rgb(var(--dt-text) / <alpha-value>)",
        muted: "rgb(var(--dt-muted) / <alpha-value>)",
        brand: "rgb(var(--dt-brand) / <alpha-value>)",
        good: "rgb(var(--dt-good) / <alpha-value>)",
        warn: "rgb(var(--dt-warn) / <alpha-value>)",
        bad: "rgb(var(--dt-bad) / <alpha-value>)",
      },
      boxShadow: {
        bento: "0 1px 0 rgb(255 255 255 / 0.06), 0 20px 60px rgb(0 0 0 / 0.45)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
