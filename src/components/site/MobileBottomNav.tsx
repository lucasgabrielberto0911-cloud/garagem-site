"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconCar,
  IconHome,
  IconMapPin,
  IconWhatsApp,
} from "@/components/site/icons";
import { whatsappUrl } from "@/lib/site";

const ITEMS = [
  { href: "/", label: "Início", Icon: IconHome },
  { href: "/estoque", label: "Estoque", Icon: IconCar },
  { href: "/contato", label: "Contato", Icon: IconMapPin },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação rápida"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-asphalt/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-4">
        <NavItem {...ITEMS[0]} active={pathname === "/"} />
        <NavItem {...ITEMS[1]} active={pathname.startsWith("/estoque")} />
        <li>
          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-16 flex-col items-center justify-center gap-1 text-brand"
          >
            <IconWhatsApp className="h-6 w-6" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              WhatsApp
            </span>
          </a>
        </li>
        <NavItem {...ITEMS[2]} active={pathname.startsWith("/contato")} />
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
  Icon: (props: { className?: string }) => JSX.Element;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex h-16 flex-col items-center justify-center gap-1 transition ${
          active ? "text-cream" : "text-muted"
        }`}
      >
        <Icon className="h-5 w-5" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </Link>
    </li>
  );
}
