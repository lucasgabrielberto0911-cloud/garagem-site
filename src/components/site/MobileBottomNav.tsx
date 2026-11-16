"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconCar,
  IconHeart,
  IconHome,
  IconRefresh,
  IconWhatsApp,
} from "@/components/site/icons";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { whatsappCampaignFromPath, whatsappUrl } from "@/lib/site";
import type { ReactNode } from "react";

const ITEMS = [
  { href: "/", label: "Início", Icon: IconHome, match: (p: string) => p === "/" },
  {
    href: "/estoque",
    label: "Estoque",
    Icon: IconCar,
    match: (p: string) => p.startsWith("/estoque"),
  },
  {
    href: "/vender",
    label: "Vender",
    Icon: IconRefresh,
    match: (p: string) => p.startsWith("/vender"),
  },
  {
    href: "/favoritos",
    label: "Favoritos",
    Icon: IconHeart,
    match: (p: string) => p.startsWith("/favoritos"),
  },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname() || "/";

  // Na página de detalhe do veículo a sticky bar assume o rodapé.
  if (pathname.startsWith("/estoque/") && pathname !== "/estoque") {
    return null;
  }

  return (
    <nav
      data-mobile-bottom-nav=""
      aria-label="Navegação rápida"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-asphalt/90 shadow-[0_-10px_30px_rgba(0,0,0,0.45)] backdrop-blur-md supports-[backdrop-filter]:bg-asphalt/80 pl-safe pr-safe lg:hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-brand/50 to-transparent"
      />
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-stretch px-1 pb-[env(safe-area-inset-bottom,0px)]">
        {ITEMS.slice(0, 2).map((item) => (
          <NavItem key={item.href} {...item} active={item.match(pathname)} />
        ))}

        <li className="flex min-w-0">
          <a
            href={whatsappUrl(undefined, {
              campaign: whatsappCampaignFromPath(pathname),
            })}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir WhatsApp da Garagem"
            onClick={() => trackWhatsAppClick("nav-mobile")}
            className="relative flex h-14 flex-1 flex-col items-center justify-center gap-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cream"
          >
            <span className="whatsapp-pulse flex h-7 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-asphalt shadow-[0_2px_10px_rgba(37,211,102,0.38)] transition active:scale-95">
              <IconWhatsApp className="h-[18px] w-[18px]" />
            </span>
            <span className="font-display text-[12px] font-semibold leading-none tracking-[0.01em] text-[#25D366]">
              WhatsApp
            </span>
          </a>
        </li>

        {ITEMS.slice(2).map((item) => (
          <NavItem key={item.href} {...item} active={item.match(pathname)} />
        ))}
      </ul>
    </nav>
  );
}

function NavItem({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => ReactNode;
  active: boolean;
}) {
  return (
    <li className="flex min-w-0">
      <Link
        href={href}
        prefetch={false}
        aria-current={active ? "page" : undefined}
        className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand touch-manipulation ${
          active ? "text-cream" : "text-cream/75 active:text-cream"
        }`}
      >
        {active ? (
          <span
            aria-hidden="true"
            className="absolute top-0 h-[2.5px] w-7 rounded-full bg-brand shadow-[0_0_8px_rgba(232,24,28,0.75)]"
          />
        ) : null}
        <span className="flex h-7 items-center justify-center">
          <Icon
            className={`h-5 w-5 shrink-0 ${active ? "text-brand-light" : "text-cream/75"}`}
          />
        </span>
        <span
          className={`font-display text-[12px] leading-none tracking-[0.01em] ${
            active ? "font-semibold text-cream" : "font-medium text-cream/80"
          }`}
        >
          {label}
        </span>
      </Link>
    </li>
  );
}
