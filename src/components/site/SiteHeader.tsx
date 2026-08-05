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
import { NAV_LINKS, site, telUrl, whatsappUrl } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-asphalt/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[72px]">
        <Link
          href="/"
          className="flex shrink-0 items-center"
          aria-label={`${site.name} — página inicial`}
        >
          <Image
            src="/branding/logo.png"
            alt={site.name}
            width={160}
            height={44}
            priority
            className="h-9 w-auto lg:h-10"
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Menu principal">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative px-3 py-2 font-display text-sm font-semibold transition ${
                  active ? "text-cream" : "text-muted hover:text-cream"
                }`}
              >
                {link.label}
                {active ? (
                  <span
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 bg-brand-gradient"
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={telUrl()}
            className="hidden items-center gap-2 text-sm text-muted transition hover:text-cream md:flex"
          >
            <IconPhone className="h-4 w-4" />
            <span className="font-medium">{site.phoneLabel}</span>
          </a>

          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-brand px-3 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] sm:px-4 sm:text-sm"
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
            className="inline-flex h-10 w-10 items-center justify-center border border-white/15 text-cream transition hover:border-brand lg:hidden"
          >
            {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="menu-mobile"
          className="border-t border-white/10 bg-asphalt lg:hidden"
        >
          <nav className="mx-auto max-w-7xl px-4 py-3 sm:px-6" aria-label="Menu mobile">
            <ul className="divide-y divide-white/5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-3 font-display text-base font-semibold text-cream"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <a
              href={telUrl()}
              className="mt-3 inline-flex items-center gap-2 text-sm text-muted"
            >
              <IconPhone className="h-4 w-4" />
              {site.phoneLabel}
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
