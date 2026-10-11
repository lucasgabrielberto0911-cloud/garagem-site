import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import { AdminShell } from "@/components/admin/AdminShell";
import "./admin.css";

// Marca: títulos em Barlow Condensed. A variável vale só dentro do painel
// (o layout raiz e o site público continuam com a Sora).
const adminDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "Painel | Garagem",
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: "/admin" },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${adminDisplay.variable} contents`}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
