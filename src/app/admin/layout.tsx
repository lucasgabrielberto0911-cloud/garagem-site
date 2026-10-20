import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import "./admin.css";
import { ReservationExpiry } from "@/components/admin/ReservationExpiry";

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
  return <AdminShell><ReservationExpiry />{children}</AdminShell>;
}
