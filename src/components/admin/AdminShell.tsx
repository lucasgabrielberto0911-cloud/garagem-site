"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconCash,
  IconDashboard,
  IconExternal,
  IconInbox,
  IconLogout,
  IconUserCircle,
  IconUsers,
} from "@/components/admin/icons";
import {
  IconCar,
  IconClose,
  IconMapPin,
  IconMenu,
  IconQuote,
} from "@/components/site/icons";

type NavItem = {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => JSX.Element;
  badgeKey?: "leads";
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", Icon: IconDashboard },
  { href: "/admin/veiculos", label: "Veículos", Icon: IconCar },
  { href: "/admin/leads", label: "Leads", Icon: IconInbox, badgeKey: "leads" },
  { href: "/admin/vendas", label: "Vendas", Icon: IconCash },
  { href: "/admin/clientes", label: "Clientes", Icon: IconUsers },
  { href: "/admin/depoimentos", label: "Depoimentos", Icon: IconQuote },
  { href: "/admin/site", label: "Dados do site", Icon: IconMapPin },
];

export function AdminShell({
  children,
  email,
  newLeads = 0,
}: {
  children: React.ReactNode;
  email?: string;
  newLeads?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const sidebar = (
    <>
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Menu do painel">
        {NAV.map(({ href, label, Icon, badgeKey }) => {
          const active =
            href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          const badge = badgeKey === "leads" && newLeads > 0 ? newLeads : null;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[46px] items-center gap-3 px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand text-cream"
                  : "text-muted hover:bg-white/5 hover:text-cream"
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span
                  className={`min-w-[22px] px-1.5 py-0.5 text-center font-display text-[11px] font-bold ${
                    active ? "bg-cream/20 text-cream" : "bg-brand text-cream"
                  }`}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-white/10 p-3">
        <Link
          href="/admin/conta"
          className={`flex min-h-[44px] items-center gap-3 px-3 py-2.5 text-sm transition ${
            pathname.startsWith("/admin/conta")
              ? "bg-brand text-cream"
              : "text-muted hover:bg-white/5 hover:text-cream"
          }`}
        >
          <IconUserCircle className="h-[18px] w-[18px] shrink-0" />
          Minha conta
        </Link>
        <Link
          href="/"
          target="_blank"
          className="flex min-h-[44px] items-center gap-3 px-3 py-2.5 text-sm text-muted transition hover:bg-white/5 hover:text-cream"
        >
          <IconExternal className="h-[18px] w-[18px] shrink-0" />
          Ver o site
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex min-h-[44px] w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-muted transition hover:bg-white/5 hover:text-brand disabled:opacity-60"
        >
          <IconLogout className="h-[18px] w-[18px] shrink-0" />
          {loggingOut ? "Saindo..." : "Sair"}
        </button>
        {email ? (
          <Link
            href="/admin/conta"
            title="Minha conta"
            className="block truncate px-3 pt-2 text-[11px] text-muted transition hover:text-cream"
          >
            {email}
          </Link>
        ) : null}
      </div>
    </>
  );

  const brand = (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
      <Link href="/admin" className="flex items-center gap-2.5">
        <Image
          src="/branding/logo.png"
          alt="Garagem"
          width={140}
          height={40}
          className="h-8 w-auto"
        />
      </Link>
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        Admin
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-asphalt text-cream lg:flex">
      <aside className="hidden w-64 flex-col border-r border-white/10 bg-ink lg:fixed lg:inset-y-0 lg:flex">
        {brand}
        <div className="h-0.5 w-full bg-brand-gradient" aria-hidden="true" />
        {sidebar}
      </aside>

      {/* Barra superior fixa no mobile. */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-ink/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <Image
            src="/branding/logo.png"
            alt="Garagem"
            width={110}
            height={32}
            className="h-7 w-auto"
          />
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Admin
          </span>
        </Link>
        <button
          type="button"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="relative flex h-11 w-11 items-center justify-center border border-white/15 text-cream transition active:bg-white/10"
        >
          {menuOpen ? (
            <IconClose className="h-5 w-5" />
          ) : (
            <IconMenu className="h-5 w-5" />
          )}
          {!menuOpen && newLeads > 0 ? (
            <span
              className="absolute -right-1 -top-1 min-w-[18px] bg-brand px-1 text-center font-display text-[10px] font-bold text-cream"
              aria-hidden="true"
            >
              {newLeads}
            </span>
          ) : null}
        </button>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-[78%] max-w-xs flex-col border-r border-white/10 bg-ink animate-slide-in-left">
            {brand}
            <div className="h-0.5 w-full bg-brand-gradient" aria-hidden="true" />
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="min-h-screen flex-1 lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
