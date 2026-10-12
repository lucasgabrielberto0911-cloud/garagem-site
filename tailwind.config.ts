import type { Config } from "tailwindcss";

const config: Config = {
  // O painel tem CSS próprio (src/app/admin/admin.css): os utilitários que só
  // ele usa ficam fora do CSS bloqueante da home, do estoque e da ficha.
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "!./src/components/admin/**",
    "!./src/app/admin/**",
  ],
  theme: {
    extend: {
      colors: {
        asphalt: "#0D0D0F",
        cream: "#F7F5F2",
        ink: "#17171A",
        brand: {
          DEFAULT: "#D91519",
          light: "#FF4448",
          orange: "#FF8A00",
          yellow: "#FFC72C",
        },
        muted: "#B4B4BA",
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
