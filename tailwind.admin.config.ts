import type { Config } from "tailwindcss";
import base, { siteBrandColors } from "./tailwind.config";

// Só os utilitários dos arquivos do painel. Tema e plugins são os do site,
// acrescidos do amarelo de aviso usado apenas em status do admin.
const config: Config = {
  ...base,
  content: [
    "./src/components/admin/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/admin/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    ...base.theme,
    extend: {
      ...base.theme?.extend,
      colors: {
        ...base.theme?.extend?.colors,
        brand: {
          ...siteBrandColors,
          yellow: "#EAB308",
        },
      },
    },
  },
};
export default config;
