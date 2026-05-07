/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#060911",
          900: "#0A0E1A",
          850: "#0D1322",
          800: "#11182B",
          750: "#161E36",
          700: "#1B2440",
          600: "#222C4D",
          500: "#2C375E",
        },
        accent: {
          gold: "#E5C07B",
          mint: "#5EEAD4",
          violet: "#A78BFA",
          rose: "#FB7185",
          sky: "#7DD3FC",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        tightish: "-0.012em",
      },
      boxShadow: {
        glass:
          "0 1px 0 0 rgba(255,255,255,0.045) inset, 0 0 0 1px rgba(255,255,255,0.04), 0 18px 48px -22px rgba(0,0,0,0.65)",
        glow: "0 0 0 1px rgba(255,255,255,0.05), 0 8px 22px -10px rgba(99,102,241,0.35)",
        ring: "0 0 0 1px rgba(255,255,255,0.06)",
      },
      backgroundImage: {
        "radial-faint":
          "radial-gradient(1200px 600px at 20% -10%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(900px 500px at 90% 0%, rgba(20,184,166,0.08), transparent 60%)",
        "card-gradient":
          "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 100%)",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        modalIn: {
          "0%": { opacity: "0", transform: "scale(0.97) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        backdropIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        pulseSoft: "pulseSoft 2.4s ease-in-out infinite",
        floatIn: "floatIn 0.32s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        slideIn: "slideIn 0.22s ease-out both",
        modalIn: "modalIn 0.22s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        backdropIn: "backdropIn 0.16s ease-out both",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
