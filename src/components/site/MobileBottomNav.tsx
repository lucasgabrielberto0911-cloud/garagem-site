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
import { whatsappUrl } from "@/lib/site";
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
      aria-label="Navegação rápida"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-asphalt/95 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] backdrop-blur pl-safe pr-safe lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch pb-safe">
        {ITEMS.slice(0, 2).map((item) => (
          <NavItem key={item.href} {...item} active={item.match(pathname)} />
        ))}

        <li className="flex flex-1">
          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir WhatsApp da Sua Garagem"
            onClick={() => trackWhatsAppClick("nav-mobile")}
            className="-mt-3 flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 touch-manipulation"
          >
            <span className="whatsapp-pulse flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-green-500/30">
              <IconWhatsApp className="h-7 w-7" />
            </span>
            <span className="text-[10px] font-semibold text-[#25D366]">
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
    <li className="flex flex-1">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition touch-manipulation ${
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
      </Link>
    </li>
  );
}
