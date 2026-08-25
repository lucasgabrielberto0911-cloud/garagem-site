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
  match: (pathname: string) => boolean;
};

const NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    Icon: IconDashboard,
    match: (pathname) => pathname === "/admin",
  },
  {
    href: "/admin/veiculos",
    label: "Veículos",
    Icon: IconCar,
    match: (pathname) => pathname.startsWith("/admin/veiculos"),
  },
  {
    href: "/admin/leads",
    label: "Leads",
    Icon: IconInbox,
    badgeKey: "leads",
    match: (pathname) => pathname.startsWith("/admin/leads"),
  },
  {
    href: "/admin/vendas",
    label: "Vendas",
    Icon: IconCash,
    match: (pathname) => pathname.startsWith("/admin/vendas"),
  },
  {
    href: "/admin/clientes",
    label: "Clientes",
    Icon: IconUsers,
    match: (pathname) => pathname.startsWith("/admin/clientes"),
  },
  {
    href: "/admin/depoimentos",
    label: "Depoimentos",
    Icon: IconQuote,
    match: (pathname) => pathname.startsWith("/admin/depoimentos"),
  },
  {
    href: "/admin/site",
    label: "Dados do site",
    Icon: IconMapPin,
    match: (pathname) => pathname.startsWith("/admin/site"),
  },
];

const BOTTOM_NAV = NAV.slice(0, 4);

export function AdminShell({
  children,
  newLeads = 0,
}: {
  children: React.ReactNode;
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
    for (const item of NAV) {
      router.prefetch(item.href);
    }
    router.prefetch("/admin/conta");
    router.prefetch("/admin/veiculos/novo");
  }, [router]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        {NAV.map(({ href, label, Icon, badgeKey, match }) => {
          const active = match(pathname);
          const badge = badgeKey === "leads" && newLeads > 0 ? newLeads : null;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[48px] items-center gap-3 px-3 py-2.5 text-sm font-medium transition touch-manipulation ${
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
          className={`flex min-h-[48px] items-center gap-3 px-3 py-2.5 text-sm transition touch-manipulation ${
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
          className="flex min-h-[48px] items-center gap-3 px-3 py-2.5 text-sm text-muted transition touch-manipulation hover:bg-white/5 hover:text-cream"
        >
          <IconExternal className="h-[18px] w-[18px] shrink-0" />
          Ver o site
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex min-h-[48px] w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-muted transition touch-manipulation hover:bg-white/5 hover:text-brand disabled:opacity-60"
        >
          <IconLogout className="h-[18px] w-[18px] shrink-0" />
          {loggingOut ? "Saindo..." : "Sair"}
        </button>
      </div>
    </>
  );

  const brand = (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
      <Link href="/admin" className="flex items-center gap-2.5">
        <Image
          src="/branding/logo-wordmark.png"
          alt="Garagem"
          width={160}
          height={29}
          className="h-7 w-auto"
        />
      </Link>
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        Admin
      </span>
    </div>
  );

  return (
    <div className="min-h-dvh bg-asphalt text-cream lg:flex">
      <aside className="hidden w-64 flex-col border-r border-white/10 bg-ink lg:fixed lg:inset-y-0 lg:flex">
        {brand}
        <div className="h-0.5 w-full bg-brand-gradient" aria-hidden="true" />
        {sidebar}
      </aside>

      {/* Barra superior fixa no mobile. */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-ink/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] backdrop-blur lg:hidden">
        <Link href="/admin" className="flex min-h-[44px] items-center gap-2 touch-manipulation">
          <Image
            src="/branding/logo-wordmark.png"
            alt="Garagem"
            width={140}
            height={25}
            className="h-6 w-auto"
          />
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Admin
          </span>
        </Link>
        <button
          type="button"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-drawer"
          onClick={() => setMenuOpen((open) => !open)}
          className="relative flex h-11 w-11 items-center justify-center border border-white/15 text-cream transition touch-manipulation active:bg-white/10"
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
        <div
          id="admin-mobile-drawer"
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu do painel"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-dvh w-[min(78%,20rem)] flex-col overflow-y-auto overscroll-contain border-r border-white/10 bg-ink pb-safe animate-slide-in-left">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
              <Link href="/admin" className="flex min-h-[44px] items-center gap-2.5">
                <Image
                  src="/branding/logo-wordmark.png"
                  alt="Garagem"
                  width={160}
                  height={29}
                  className="h-7 w-auto"
                />
              </Link>
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setMenuOpen(false)}
                className="flex h-11 w-11 items-center justify-center border border-white/15 text-cream transition touch-manipulation active:bg-white/10"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            <div className="h-0.5 w-full bg-brand-gradient" aria-hidden="true" />
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="min-h-dvh flex-1 lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-3 pt-4 pb-admin-nav sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
          {children}
        </div>
      </div>

      <nav
        aria-label="Atalhos do painel"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch pb-safe">
          {BOTTOM_NAV.map(({ href, label, Icon, badgeKey, match }) => {
            const active = match(pathname);
            const badge = badgeKey === "leads" && newLeads > 0 ? newLeads : null;
            return (
              <li key={href} className="flex flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition touch-manipulation ${
                    active ? "text-cream" : "text-muted active:text-cream"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span
                    className={`text-[10px] uppercase tracking-wide ${
                      active ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {label}
                  </span>
                  {badge ? (
                    <span className="absolute right-1/2 top-1 min-w-[16px] translate-x-[14px] bg-brand px-1 text-center font-display text-[9px] font-bold text-cream">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
