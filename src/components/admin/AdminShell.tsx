"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/veiculos", label: "Veículos" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/vendas", label: "Vendas" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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

  const nav = (
    <>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand text-cream"
                  : "text-muted hover:bg-white/5 hover:text-cream"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full px-3 py-2.5 text-left text-sm text-muted transition hover:bg-white/5 hover:text-brand disabled:opacity-60"
        >
          {loggingOut ? "Saindo..." : "Sair"}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-asphalt text-cream lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r border-white/10 bg-ink lg:fixed lg:inset-y-0 lg:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <Image
            src="/logo.png"
            alt="Garagem"
            width={120}
            height={36}
            className="h-8 w-auto"
          />
        </div>
        <div className="h-0.5 w-full bg-brand-gradient" aria-hidden="true" />
        {nav}
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-ink px-4 py-3 lg:hidden">
        <Image
          src="/logo.png"
          alt="Garagem"
          width={100}
          height={30}
          className="h-7 w-auto"
        />
        <button
          type="button"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center border border-white/15 text-cream"
        >
          <span className="sr-only">Menu</span>
          <div className="space-y-1.5">
            <span
              className={`block h-0.5 w-5 bg-cream transition ${menuOpen ? "translate-y-2 rotate-45" : ""}`}
            />
            <span
              className={`block h-0.5 w-5 bg-cream transition ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block h-0.5 w-5 bg-cream transition ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </div>
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-asphalt/70 lg:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <aside
            className="flex h-full w-72 flex-col border-r border-white/10 bg-ink"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
              <Image
                src="/logo.png"
                alt="Garagem"
                width={120}
                height={36}
                className="h-8 w-auto"
              />
            </div>
            <div className="h-0.5 w-full bg-brand-gradient" aria-hidden="true" />
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="min-h-screen flex-1 lg:pl-64">
        <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
