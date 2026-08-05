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
  title: "Garagem",
  description: "Garagem — loja oficial",
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
