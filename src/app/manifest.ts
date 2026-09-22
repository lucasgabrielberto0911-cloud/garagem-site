import type { MetadataRoute } from "next";
import { PWA_START_URL } from "@/lib/pwa-install";
import { PWA_WHATSAPP_SHORTCUT_PATH, site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name} — Seminovos no ${site.state}`,
    short_name: site.name,
    description: site.tagline,
    id: "/",
    start_url: PWA_START_URL,
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    launch_handler: {
      client_mode: ["focus-existing", "navigate-existing", "auto"],
    },
    background_color: "#0D0D0F",
    theme_color: "#0D0D0F",
    lang: "pt-BR",
    categories: ["shopping", "business"],
    icons: [
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Estoque",
        short_name: "Estoque",
        description: "Ver os seminovos disponíveis",
        url: "/estoque",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "WhatsApp",
        short_name: "WhatsApp",
        description: "Chamar a loja no WhatsApp",
        url: PWA_WHATSAPP_SHORTCUT_PATH,
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Vender ou trocar",
        short_name: "Vender",
        description: "Avaliar um veículo para venda ou troca",
        url: "/vender",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Favoritos",
        short_name: "Favoritos",
        description: "Veículos salvos neste aparelho",
        url: "/favoritos",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    screenshots: [
      {
        src: "/screenshots/narrow.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "Estoque da Sua Garagem no celular",
      },
      {
        src: "/screenshots/wide.png",
        sizes: "1920x1080",
        type: "image/png",
        form_factor: "wide",
        label: "Estoque da Sua Garagem no computador",
      },
    ],
  };
}
