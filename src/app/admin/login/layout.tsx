import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar | Sua Garagem",
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: "/admin/login" },
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
