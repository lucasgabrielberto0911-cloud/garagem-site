import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import { AppToaster } from "@/components/Toaster";
import "./globals.css";

const display = Sora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Garagem | Seminovos com procedência no Espírito Santo",
    template: "%s",
  },
  description:
    "Seminovos revisados, com procedência verificada e vistoria completa. Compra, venda, troca e financiamento na Garagem.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${display.variable} ${body.variable} font-body antialiased bg-asphalt text-cream`}
      >
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
