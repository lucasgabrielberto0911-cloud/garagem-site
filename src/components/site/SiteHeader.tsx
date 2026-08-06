"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconClose,
  IconMenu,
  IconPhone,
  IconWhatsApp,
} from "@/components/site/icons";
import { FavoritesLink } from "@/components/site/FavoritesLink";
import {
  NAV_LINKS,
  PHONES,
  SECONDARY_LINKS,
  site,
  telUrl,
  whatsappUrl,
} from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 pt-safe transition-[background-color,border-color,backdrop-filter] duration-200 ${
          scrolled || open
            ? "border-b border-white/10 bg-asphalt/98 backdrop-blur-md"
            : "border-b border-transparent bg-asphalt/70 backdrop-blur-sm"
        }`}
      >
        <div
          className={`mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 transition-[height] duration-200 sm:gap-3 sm:px-6 xl:gap-4 ${
            scrolled
              ? "h-[64px] sm:h-[72px] lg:h-[76px]"
              : "h-[72px] sm:h-[84px] lg:h-[88px]"
          }`}
        >
          <Link
            href="/"
            className="flex min-w-0 shrink items-center focus-visible:outline-offset-4"
            aria-label={`${site.name} — página inicial`}
          >
            <Image
              src="/branding/logo-wordmark.png"
              alt={site.name}
              width={280}
              height={50}
              priority
              className={`w-auto max-w-[min(52vw,200px)] transition-all duration-300 sm:max-w-none ${
                scrolled
                  ? "h-8 sm:h-10 lg:h-10 xl:h-12"
                  : "h-9 sm:h-11 lg:h-11 xl:h-[52px]"
              }`}
            />
          </Link>

          <nav
            className="hidden flex-1 items-center justify-center gap-0.5 xl:gap-1 lg:flex"
            aria-label="Menu principal"
          >
            {NAV_LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative px-2.5 py-2 font-display text-[13px] font-semibold transition xl:px-3 xl:text-sm ${
                    active ? "text-cream" : "text-muted hover:text-cream"
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute inset-x-2.5 -bottom-0.5 h-0.5 transition xl:inset-x-3 ${
                      active
                        ? "bg-brand-gradient"
                        : "bg-white/0 group-hover:bg-white/35 group-focus-visible:bg-white/35"
                    }`}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 xl:gap-3">
            <a
              href={telUrl()}
              className="hidden items-center gap-2 text-sm text-muted transition hover:text-cream xl:flex"
            >
              <IconPhone className="h-4 w-4" />
              <span className="font-medium">{site.phoneLabel}</span>
            </a>

            <FavoritesLink />

            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 bg-brand px-3.5 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] sm:inline-flex xl:px-4"
            >
              <IconWhatsApp className="h-4 w-4" />
              WhatsApp
            </a>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="menu-mobile"
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              className="inline-flex h-11 w-11 items-center justify-center border border-white/15 text-cream transition hover:border-brand touch-manipulation lg:hidden"
            >
              {open ? (
                <IconClose className="h-5 w-5" />
              ) : (
                <IconMenu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-[45] lg:hidden" id="menu-mobile">
          <div
            role="button"
            tabIndex={0}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setOpen(false);
              }
            }}
            aria-label="Fechar menu"
          />
          <div className="relative mt-[calc(4.5rem+env(safe-area-inset-top,0px))] h-[calc(100dvh-4.5rem-env(safe-area-inset-top,0px))] overflow-y-auto overscroll-contain border-t border-white/10 bg-asphalt animate-slide-up pb-nav-safe sm:mt-[84px] sm:h-[calc(100dvh-84px)] lg:mt-[96px] lg:h-[calc(100dvh-96px)]">
            <nav className="px-5 py-4" aria-label="Menu mobile">
              <ul className="space-y-1">
                {NAV_LINKS.map((link) => {
                  const active =
                    link.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-[52px] items-center justify-center px-4 py-4 font-display text-base font-semibold transition touch-manipulation ${
                          active
                            ? "bg-brand/10 text-cream"
                            : "text-cream active:bg-white/5"
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-white/10 px-4 pt-4">
                {SECONDARY_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="inline-flex min-h-[36px] items-center text-sm text-muted transition active:text-cream"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-4 space-y-3 border-t border-white/10 pt-5">
                <a
                  href={whatsappUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="whatsapp-btn flex min-h-[52px] w-full items-center justify-center gap-2.5 px-4 py-4 font-display text-base font-semibold text-white touch-manipulation"
                >
                  <IconWhatsApp className="h-5 w-5" />
                  Chamar no WhatsApp
                </a>
                {PHONES.map((phone, index) => (
                  <a
                    key={phone.digits}
                    href={telUrl(index)}
                    onClick={() => setOpen(false)}
                    className="flex min-h-[52px] w-full items-center justify-center gap-2.5 border border-brand/50 px-4 py-4 font-display text-base font-semibold text-brand touch-manipulation"
                  >
                    <IconPhone className="h-5 w-5" />
                    {phone.label}
                  </a>
                ))}
              </div>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
