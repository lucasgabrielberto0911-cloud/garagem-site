import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { AppToaster } from "@/components/Toaster";
import { BootSplash } from "@/components/site/BootSplash";
import { PwaRegister } from "@/components/site/PwaRegister";
import { site } from "@/lib/site";
import "./globals.css";

const display = Sora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
  preload: false,
  adjustFontFallback: true,
});

const description =
  "Seminovos com procedência verificada em Aracruz, Vitória, Linhares, Serra, Vila Velha e região do ES. Compra, venda, troca e financiamento na Sua Garagem.";

function supabaseOrigin() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | Seminovos com procedência no ${site.state}`,
    template: "%s",
  },
  description,
  applicationName: site.name,
  keywords: [
    "seminovos",
    "carros usados",
    "motos seminovas",
    "revenda de veículos",
    "Espírito Santo",
    "Aracruz",
    "Vitória",
    "Linhares",
    "Serra",
    "Vila Velha",
    "financiamento de carros",
    "vender carro usado",
    "troca de veículo",
    site.name,
  ],
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: site.url,
    siteName: site.name,
    title: `${site.name} | Seminovos com procedência no ${site.state}`,
    description,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: `${site.name} — seminovos no ${site.state}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} | Seminovos com procedência no ${site.state}`,
    description,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    // Next 16 emite `mobile-web-app-capable` quando capable=true (padrão).
    // Mantemos o padrão do Next e só acrescentamos o prefixo Apple em `other`.
    capable: true,
    title: site.name,
    statusBarStyle: "black-translucent",
    startupImage: [
      {
        url: "/branding/splash-750x1334.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/branding/splash-828x1792.png",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/branding/splash-1125x2436.png",
        media:
          "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/branding/splash-1170x2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/branding/splash-1170x2532.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/branding/splash-1284x2778.png",
        media:
          "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/branding/splash-1290x2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
      { url: "/branding/splash-iphone.png" },
    ],
  },
  /**
   * Next 16 só emite `mobile-web-app-capable` (via appleWebApp.capable).
   * iOS Safari ainda lê `apple-mobile-web-app-capable` — uma vez, sem
   * duplicar a meta padronizada.
   */
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  formatDetection: { telephone: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0D0D0F" },
    { media: "(prefers-color-scheme: light)", color: "#0D0D0F" },
    { color: "#0D0D0F" },
  ],
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const storageOrigin = supabaseOrigin();

  return (
    <html lang="pt-BR">
      {storageOrigin ? (
        <head>
          <link rel="preconnect" href={storageOrigin} crossOrigin="anonymous" />
        </head>
      ) : null}
      <body
        className={`${display.variable} ${body.variable} font-body antialiased bg-asphalt text-cream`}
      >
        <BootSplash />
        {children}
        <PwaRegister />
        <AppToaster />
      </body>
    </html>
  );
}
