import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { AppToaster } from "@/components/Toaster";
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
  "Seminovos com procedência verificada em Aracruz, Vitória, Linhares, Serra, Vila Velha e região do ES. Compra, venda, troca e financiamento na Garagem.";

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
    capable: true,
    title: site.name,
    statusBarStyle: "black-translucent",
  },
  /**
   * O Next emite apenas a meta da Apple, que os navegadores atuais avisam estar
   * obsoleta. A versão padronizada mantém o app instalável sem o alerta.
   */
  other: { "mobile-web-app-capable": "yes" },
  formatDetection: { telephone: true },
};

export const viewport: Viewport = {
  themeColor: "#0D0D0F",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
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
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
