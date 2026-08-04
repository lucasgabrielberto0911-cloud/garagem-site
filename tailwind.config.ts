import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        asphalt: "#0D0D0F",
        cream: "#F7F5F2",
        ink: "#17171A",
        brand: {
          DEFAULT: "#E8181C",
          orange: "#FF8A00",
          yellow: "#FFC72C",
        },
        muted: "#8A8A8E",
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(90deg, #E8181C 0%, #FF8A00 50%, #FFC72C 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
