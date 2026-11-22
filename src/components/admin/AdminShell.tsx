"use client";

import { ActionSheet, ActionSheetLink } from "@/components/admin/ActionSheet";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { AdminNotifications } from "@/components/admin/AdminNotifications";
import { handleFocusTrap } from "@/lib/focus-trap";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  IconCash,
  IconClock,
  IconDashboard,
  IconExternal,
  IconLogout,
  IconPlus,
  IconUserCircle,
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
  group: "Carros" | "Vendas" | "Site";
  Icon: (props: { className?: string }) => ReactNode;
  match: (pathname: string) => boolean;
};

const NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Central",
    group: "Carros",
    Icon: IconDashboard,
    match: (pathname) => pathname === "/admin",
  },
  {
    href: "/admin/veiculos",
    label: "Veículos",
    group: "Carros",
    Icon: IconCar,
    match: (pathname) => pathname.startsWith("/admin/veiculos"),
  },
  {
    href: "/admin/compra",
    label: "Compra",
    group: "Carros",
    Icon: IconCash,
    match: (pathname) => pathname.startsWith("/admin/compra"),
  },
  {
    href: "/admin/em-preparacao",
    label: "Em preparação",
    group: "Carros",
    Icon: IconCar,
    match: (pathname) => pathname.startsWith("/admin/em-preparacao"),
  },
  {
    href: "/admin/parados",
    label: "Carros parados",
    group: "Carros",
    Icon: IconClock,
    match: (pathname) => pathname.startsWith("/admin/parados"),
  },
  {
    href: "/admin/vendas",
    label: "Vendas",
    group: "Vendas",
    Icon: IconCash,
    match: (pathname) => pathname.startsWith("/admin/vendas"),
  },
  {
    href: "/admin/promissorias",
    label: "Promissórias",
    group: "Vendas",
    Icon: IconCash,
    match: (pathname) => pathname.startsWith("/admin/promissorias"),
  },
  {
    href: "/admin/site",
    label: "Dados do site",
    group: "Site",
    Icon: IconMapPin,
    match: (pathname) => pathname.startsWith("/admin/site"),
  },
  { href: "/admin/catalogo", label: "Catálogo Meta", group: "Site", Icon: IconExternal, match: (pathname) => pathname.startsWith("/admin/catalogo") },
  {
    href: "/admin/depoimentos",
    label: "Depoimentos",
    group: "Site",
    Icon: IconQuote,
    match: (pathname) => pathname.startsWith("/admin/depoimentos"),
  },
  {
    href: "/admin/ajuda",
    label: "Ajuda",
    group: "Site",
    Icon: IconQuote,
    match: (pathname) => pathname.startsWith("/admin/ajuda"),
  },
];

const NAV_GROUPS: NavItem["group"][] = ["Carros", "Vendas", "Site"];
const BOTTOM_HREFS = new Set(["/admin", "/admin/veiculos", "/admin/parados"]);
const DRAWER_ONLY = [
  ...NAV.filter((item) => !BOTTOM_HREFS.has(item.href)).map((item) => item.href),
  "/admin/conta",
];

const NAV_BY_HREF = new Map(NAV.map((item) => [item.href, item]));

export function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [costWarnings, setCostWarnings] = useState<number | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

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
            setCostWarnings(
              typeof data.notifications === "number" ? data.notifications : null,
            );
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
    setQuickOpen(false);
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

  const moreActive =
    menuOpen || DRAWER_ONLY.some((href) => pathname.startsWith(href));
  const centralItem = NAV_BY_HREF.get("/admin")!;
  const vehiclesItem = NAV_BY_HREF.get("/admin/veiculos")!;
  const parkedItem = NAV_BY_HREF.get("/admin/parados")!;

  const sidebar = (
    <>
      <nav
        className="flex flex-1 flex-col gap-4 p-3 font-display"
        aria-label="Menu do painel"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group} role="group" aria-label={group}>
            <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-cream/75">
              {group}
            </h2>
            {NAV.filter((item) => item.group === group).map(
              ({ href, label, Icon, match }) => {
                const active = match(pathname);
                return (
                  <Link
                    prefetch={false}
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[48px] items-center gap-3 px-3 py-2.5 text-sm font-medium transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      active
                        ? "bg-brand text-white"
                        : "text-cream/80 hover:bg-white/5 hover:text-cream"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1">{label}</span>
                  </Link>
                );
              },
            )}
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/15 p-3 font-display">
        <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-cream/75">
          Conta
        </h2>
        <Link
          prefetch={false}
          href="/admin/conta"
          onClick={() => setMenuOpen(false)}
          aria-current={pathname.startsWith("/admin/conta") ? "page" : undefined}
          className={`flex min-h-[48px] items-center gap-3 px-3 py-2.5 text-sm transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            pathname.startsWith("/admin/conta")
              ? "bg-brand text-white"
              : "text-cream/80 hover:bg-white/5 hover:text-cream"
          }`}
        >
          <IconUserCircle className="h-[18px] w-[18px]" />
          Minha conta
        </Link>
        <Link
          prefetch={false}
          href="/"
          target="_blank"
          onClick={() => setMenuOpen(false)}
          className="flex min-h-[48px] items-center gap-3 px-3 py-2.5 text-sm text-cream/80 transition touch-manipulation hover:bg-white/5 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <IconExternal className="h-[18px] w-[18px]" />
          Ver o site
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex min-h-[48px] w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-cream/80 transition touch-manipulation hover:bg-white/5 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
        >
          <IconLogout className="h-[18px] w-[18px]" />
          {loggingOut ? "Saindo..." : "Sair"}
        </button>
      </div>
    </>
  );

  const brand = (
    <div className="flex items-center justify-between gap-3 border-b border-white/15 px-5 py-4">
      <Link
        prefetch={false}
        href="/admin"
        className="flex min-h-[44px] items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Image
          src="/branding/logo-wordmark.webp"
          alt="Garagem"
          width={160}
          height={29}
          className="h-7 w-auto"
        />
      </Link>
      <span className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-cream/75">
        Admin
      </span>
    </div>
  );

  return (
    <div className="admin-shell min-h-dvh bg-asphalt text-cream lg:flex">
      <a
        href="#painel"
        className="fixed left-4 top-0 z-[80] -translate-y-full bg-brand px-4 py-3 font-display text-sm font-semibold text-white outline-none transition focus-visible:translate-y-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
      >
        Pular para o conteúdo
      </a>
      <aside className="hidden w-64 flex-col border-r border-white/15 bg-ink lg:fixed lg:inset-y-0 lg:flex lg:overflow-y-auto">
        {brand}
        {sidebar}
      </aside>

      <div className="admin-header-bar sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-white/15 bg-ink/95 px-3 py-2 pt-safe backdrop-blur lg:hidden">
        <Link
          prefetch={false}
          href="/admin"
          className="flex min-h-[44px] items-center gap-2 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Image
            src="/branding/logo-wordmark.webp"
            alt="Garagem"
            width={160}
            height={29}
            className="h-6 w-auto"
          />
          <span className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-cream/75">
            Admin
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <AdminSearch />
          <AdminNotifications count={costWarnings} onCount={setCostWarnings} />
          <Link
            prefetch={false}
            href="/"
            target="_blank"
            className="admin-site-link inline-flex min-h-[44px] items-center gap-1.5 px-2.5 font-display text-xs font-semibold text-cream/80 transition touch-manipulation hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Site
            <IconExternal className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-drawer"
            onClick={() => setMenuOpen(true)}
            className="admin-header-menu flex h-11 w-11 items-center justify-center text-cream/80 transition touch-manipulation hover:text-cream active:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <IconMenu className="h-5 w-5" />
          </button>
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
            className="absolute inset-0 bg-asphalt/75 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-dvh w-[min(78%,20rem)] flex-col overflow-y-auto overscroll-contain border-r border-white/15 bg-ink pb-safe animate-slide-in-left">
            <div className="flex items-center justify-between gap-3 border-b border-white/15 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
              <Link
                prefetch={false}
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[44px] items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
                className="flex h-11 w-11 items-center justify-center border border-white/20 text-cream transition touch-manipulation active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
        className="admin-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-white/15 bg-ink/95 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch pb-safe font-display">
          {[centralItem, vehiclesItem].map(({ href, label, Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={href} className="flex flex-1">
                <Link
                  prefetch={false}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
                    active ? "text-cream" : "text-cream/80 active:text-cream"
                  }`}
                >
                  {active ? (
                    <span
                      className="absolute inset-x-5 top-0 h-0.5 bg-brand"
                      aria-hidden="true"
                    />
                  ) : null}
                  <Icon className="h-5 w-5" />
                  <span
                    className={`text-xs ${active ? "font-semibold" : "font-medium"}`}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}

          <li className="flex flex-1">
            <button
              type="button"
              aria-label="Ações de carro"
              aria-haspopup="dialog"
              aria-expanded={quickOpen}
              onClick={() => setQuickOpen(true)}
              className="flex min-h-[56px] flex-1 items-center justify-center py-1.5 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-lg">
                <IconPlus className="h-6 w-6" />
              </span>
            </button>
          </li>

          <li className="flex flex-1">
            <Link
              prefetch={false}
              href={parkedItem.href}
              aria-current={parkedItem.match(pathname) ? "page" : undefined}
              className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
                parkedItem.match(pathname)
                  ? "text-cream"
                  : "text-cream/80 active:text-cream"
              }`}
            >
              {parkedItem.match(pathname) ? (
                <span
                  className="absolute inset-x-5 top-0 h-0.5 bg-brand"
                  aria-hidden="true"
                />
              ) : null}
              <parkedItem.Icon className="h-5 w-5" />
              <span
                className={`text-xs ${
                  parkedItem.match(pathname) ? "font-semibold" : "font-medium"
                }`}
              >
                Parados
              </span>
            </Link>
          </li>

          <li className="flex flex-1">
            <button
              type="button"
              aria-label="Mais"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls="admin-mobile-drawer"
              onClick={() => setMenuOpen((open) => !open)}
              className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
                moreActive
                  ? "text-cream"
                  : "text-cream/80 active:text-cream"
              }`}
            >
              {moreActive ? (
                <span
                  className="absolute inset-x-5 top-0 h-0.5 bg-brand"
                  aria-hidden="true"
                />
              ) : null}
              {menuOpen ? (
                <IconClose className="h-5 w-5" />
              ) : (
                <IconMenu className="h-5 w-5" />
              )}
              <span className="text-xs font-medium">Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      <ActionSheet
        open={quickOpen}
        title="Ações de carro"
        subtitle="Atalhos rápidos do estoque"
        onClose={() => setQuickOpen(false)}
      >
        <ActionSheetLink
          href="/admin/veiculos/novo"
          icon={<IconPlus className="h-4 w-4 text-red-400" />}
          label="Cadastrar carro"
          hint="Novo anúncio no estoque"
          onNavigate={() => setQuickOpen(false)}
        />
        <ActionSheetLink
          href="/admin/compra"
          icon={<IconCash className="h-4 w-4" />}
          label="Avaliar compra"
          hint="Simular margem e preço de compra"
          onNavigate={() => setQuickOpen(false)}
        />
        <ActionSheetLink
          href="/admin/em-preparacao"
          icon={<IconCar className="h-4 w-4" />}
          label="Em preparação"
          hint="Carros comprados antes de anunciar"
          onNavigate={() => setQuickOpen(false)}
        />
        <ActionSheetLink
          href="/"
          external
          icon={<IconExternal className="h-4 w-4" />}
          label="Ver site"
          hint="Abrir catálogo público em nova aba"
          onNavigate={() => setQuickOpen(false)}
        />
      </ActionSheet>
    </div>
  );
}
