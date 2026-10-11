import type { Config } from "tailwindcss";
import base from "./tailwind.config";

// Só os utilitários dos arquivos do painel. Tema e plugins são os do site.
const config: Config = {
  ...base,
  content: [
    "./src/components/admin/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/admin/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};
export default config;
