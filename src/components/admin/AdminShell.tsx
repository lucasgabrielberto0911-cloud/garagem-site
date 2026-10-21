"use client";

import { AdminSearch } from "@/components/admin/AdminSearch";
import { AdminNotifications } from "@/components/admin/AdminNotifications";
import { handleFocusTrap } from "@/lib/focus-trap";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  IconCalendar,
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
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  group: "Hoje" | "Estoque" | "Relacionamento" | "Site";
  Icon: (props: { className?: string }) => ReactNode;
  badgeKey?: "leads" | "agenda";
  match: (pathname: string) => boolean;
};

const NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    group: "Hoje",
    Icon: IconDashboard,
    match: (pathname) => pathname === "/admin",
  },
  {
    href: "/admin/veiculos",
    label: "Veículos",
    group: "Estoque",
    Icon: IconCar,
    match: (pathname) => pathname.startsWith("/admin/veiculos"),
  },
  {
    href: "/admin/em-preparacao",
    label: "Em preparação",
    group: "Estoque",
    Icon: IconCar,
    match: (pathname) => pathname.startsWith("/admin/em-preparacao"),
  },
  {
    href: "/admin/leads",
    label: "Leads",
    group: "Relacionamento",
    Icon: IconInbox,
    badgeKey: "leads",
    match: (pathname) => pathname.startsWith("/admin/leads"),
  },
  {
    href: "/admin/agenda",
    label: "Agenda",
    group: "Hoje",
    Icon: IconCalendar,
    badgeKey: "agenda",
    match: (pathname) => pathname.startsWith("/admin/agenda"),
  },
  {
    href: "/admin/clientes",
    label: "Clientes",
    group: "Relacionamento",
    Icon: IconUsers,
    match: (pathname) => pathname.startsWith("/admin/clientes"),
  },
  {
    href: "/admin/vendas",
    label: "Vendas",
    group: "Relacionamento",
    Icon: IconCash,
    match: (pathname) => pathname.startsWith("/admin/vendas"),
  },
  {
    href: "/admin/depoimentos",
    label: "Depoimentos",
    group: "Site",
    Icon: IconQuote,
    match: (pathname) => pathname.startsWith("/admin/depoimentos"),
  },
  {
    href: "/admin/site",
    label: "Dados do site",
    group: "Site",
    Icon: IconMapPin,
    match: (pathname) => pathname.startsWith("/admin/site"),
  },
];

const NAV_GROUPS: NavItem["group"][] = ["Hoje", "Estoque", "Relacionamento", "Site"];
const BOTTOM_NAV = NAV.slice(0, 3);
const DRAWER_ONLY = [...NAV.slice(3).map((item) => item.href), "/admin/conta"];

export function AdminShell({
  children,
  newLeads: initialLeads = 0,
}: {
  children: React.ReactNode;
  newLeads?: number;
}) {
  const [costWarnings, setCostWarnings] = useState<number | null>(null);
  const [newLeads, setNewLeads] = useState(initialLeads);
  const [agendaDue, setAgendaDue] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Busca ao trocar de tela e a cada 60 s com a aba visível, para o lead novo
  // aparecer sem recarregar. Ao voltar para a aba, atualiza na hora.
  useEffect(() => {
    if (pathname === "/admin/login") return;
    let controller = new AbortController();
    function refresh() {
      controller.abort();
      controller = new AbortController();
      fetch("/api/admin/badge", { signal: controller.signal })
        .then(async (response) => {
          if (response.ok) {
            const data = await response.json();
            if (typeof data.count === "number") setNewLeads(data.count);
            if (typeof data.agenda === "number") setAgendaDue(data.agenda);
            setCostWarnings(typeof data.notifications === "number" ? data.notifications : null);
          }
        })
        .catch(() => {});
    }
    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    refresh();
    const timer = window.setInterval(onVisible, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const drawer = drawerRef.current;
    drawer
      ?.querySelector<HTMLElement>("button[aria-label='Fechar menu']")
      ?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
      if (drawer) handleFocusTrap(event, drawer);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [menuOpen]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("logout");
      router.push("/admin/login");
      router.refresh();
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
    } finally {
      setLoggingOut(false);
    }
  }

  const moreActive = menuOpen || DRAWER_ONLY.some((href) => pathname.startsWith(href));

  const sidebar = (
    <>
      <nav
        className="flex flex-1 flex-col gap-4 p-3 font-display"
        aria-label="Menu do painel"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group} role="group" aria-label={group}>
            <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">
              {group}
            </h2>
            {NAV.filter((item) => item.group === group).map(({ href, label, Icon, badgeKey, match }) => {
              const active = match(pathname);
              const badge = (badgeKey === "leads" ? newLeads : badgeKey === "agenda" ? agendaDue : 0) || null;

              return (
                <Link
                  prefetch={false}
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[48px] items-center gap-3 px-3 py-2.5 text-sm font-medium transition touch-manipulation ${
                    active
                      ? "bg-brand text-white"
                      : "text-muted hover:bg-white/5 hover:text-cream"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1">{label}</span>
                  {badge ? (
                    <span
                      className={`min-w-[22px] px-1.5 py-0.5 text-center font-display text-xs font-bold ${
                        active ? "bg-cream/20 text-cream" : "bg-brand text-white"
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/10 p-3 font-display">
        <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">
          Conta
        </h2>
        <Link
          prefetch={false}
          href="/admin/conta"
          onClick={() => setMenuOpen(false)}
          aria-current={pathname.startsWith("/admin/conta") ? "page" : undefined}
          className={`flex min-h-[48px] items-center gap-3 px-3 py-2.5 text-sm transition touch-manipulation ${
            pathname.startsWith("/admin/conta")
              ? "bg-brand text-white"
              : "text-muted hover:bg-white/5 hover:text-cream"
          }`}
        >
          <IconUserCircle className="h-[18px] w-[18px] shrink-0" />
          Minha conta
        </Link>
        <Link
          prefetch={false}
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
      <Link prefetch={false} href="/admin" className="flex items-center gap-2.5">
        <Image
          src="/branding/logo-wordmark.webp"
          alt="Garagem"
          width={160}
          height={29}
          className="h-7 w-auto"
        />
      </Link>
      <span className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        Admin
      </span>
    </div>
  );

  return (
    <div className="min-h-dvh bg-asphalt text-cream lg:flex">
      <a
        href="#painel"
        className="fixed left-4 top-0 z-[80] -translate-y-full bg-brand px-4 py-3 font-display text-sm font-semibold text-white outline-none transition focus:translate-y-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
      >
        Pular para o conteúdo
      </a>
      <aside className="hidden w-64 flex-col border-r border-white/10 bg-ink lg:fixed lg:inset-y-0 lg:flex lg:overflow-y-auto">
        {brand}
        <div className="h-0.5 w-full bg-brand-gradient" aria-hidden="true" />
        {sidebar}
      </aside>

      {/*
        Celular: a barra do topo rola junto (a navegação fica na bottom nav,
        com "Mais" abrindo o menu). A faixa fixa cobre o notch no PWA, que
        usa status bar translúcida.
      */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top,0px)] bg-ink lg:hidden"
        aria-hidden="true"
      />
      <div className="flex items-center justify-between border-b border-white/10 bg-ink px-4 pb-1.5 pt-[max(0.375rem,env(safe-area-inset-top,0px))] lg:hidden">
        <Link
          prefetch={false}
          href="/admin"
          className="flex min-h-[44px] items-center gap-2 touch-manipulation"
        >
          <Image
            src="/branding/logo-wordmark.webp"
            alt="Garagem"
            width={140}
            height={25}
            className="h-6 w-auto"
          />
          <span className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Admin
          </span>
        </Link>
        <div className="flex shrink-0 items-center">
          <AdminSearch />
        <Link
          prefetch={false}
          href="/"
          target="_blank"
          aria-label="Ver o site"
          className="hidden h-11 w-11 items-center justify-center text-muted transition touch-manipulation active:text-cream min-[380px]:flex"
        >
          <IconExternal className="h-[18px] w-[18px]" />
        </Link>
          <AdminNotifications count={costWarnings} onCount={setCostWarnings} />
        </div>
      </div>

      {menuOpen ? (
        <div
          ref={drawerRef}
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
              <Link
                prefetch={false}
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[44px] items-center gap-2.5"
              >
                <Image
                  src="/branding/logo-wordmark.webp"
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
            <div
              className="h-0.5 w-full bg-brand-gradient"
              aria-hidden="true"
            />
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="min-h-dvh min-w-0 flex-1 lg:pl-64">
        <div className="mx-auto hidden max-w-6xl justify-end px-8 pt-3 lg:flex">
          <AdminSearch />
          <AdminNotifications count={costWarnings} onCount={setCostWarnings} />
        </div>
        <main
          id="painel"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl px-3 pt-4 pb-admin-nav outline-none sm:px-6 sm:pt-6 lg:px-8 lg:pt-2"
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="Atalhos do painel"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch pb-safe font-display">
          {BOTTOM_NAV.map(({ href, label, Icon, badgeKey, match }) => {
            const active = match(pathname);
            const badge =
              (badgeKey === "leads" ? newLeads : badgeKey === "agenda" ? agendaDue : 0) || null;
            return (
              <li key={href} className="flex flex-1">
                <Link
                  prefetch={false}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition touch-manipulation ${
                    active ? "text-cream" : "text-muted active:text-cream"
                  }`}
                >
                  {active ? (
                    <span className="absolute inset-x-5 top-0 h-0.5 bg-brand" aria-hidden="true" />
                  ) : null}
                  <Icon className="h-5 w-5" />
                  <span
                    className={`text-xs ${
                      active ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {label}
                  </span>
                  {badge ? (
                    <span className="absolute right-1/2 top-1 min-w-[16px] translate-x-[14px] bg-brand px-1 text-center font-display text-xs font-bold leading-4 text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              type="button"
              aria-label="Mais"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls="admin-mobile-drawer"
              onClick={() => setMenuOpen((open) => !open)}
              className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition touch-manipulation ${
                moreActive
                  ? "text-cream"
                  : "text-muted active:text-cream"
              }`}
            >
              {moreActive ? (
                <span className="absolute inset-x-5 top-0 h-0.5 bg-brand" aria-hidden="true" />
              ) : null}
              {menuOpen ? (
                <IconClose className="h-5 w-5" />
              ) : (
                <IconMenu className="h-5 w-5" />
              )}
              <span className="text-xs font-medium">Mais</span>
              {agendaDue > 0 ? (
                <span className="absolute right-1/2 top-1 min-w-[16px] translate-x-[14px] bg-brand px-1 text-center font-display text-xs font-bold leading-4 text-white">
                  {agendaDue > 9 ? "9+" : agendaDue}
                </span>
              ) : null}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
