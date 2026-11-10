import {
  IconArrowRight,
  IconCar,
  IconInstagram,
  IconWhatsApp,
} from "@/components/site/icons";
import {
  isInternalHref,
  siteLinkHref,
  siteLinkKind,
  type SiteLink,
  type SiteLinkKind,
} from "@/lib/site-links";

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M14 8h2.5V4.5H14a4 4 0 0 0-4 4V11H7.5v3.5H10V21h3.5v-6.5H16l.5-3.5h-3V8.8c0-.4.3-.8.8-.8Z" />
    </svg>
  );
}

/** Etiqueta de anúncio: OLX não tem ícone neutro no restante do site. */
function IconTag({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M3 12.2V4.5A1.5 1.5 0 0 1 4.5 3h7.7a1.5 1.5 0 0 1 1.06.44l7.3 7.3a1.5 1.5 0 0 1 0 2.12l-7.7 7.7a1.5 1.5 0 0 1-2.12 0l-7.3-7.3A1.5 1.5 0 0 1 3 12.2Z" />
      <path d="M7.5 7.5h.01" />
    </svg>
  );
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </svg>
  );
}

const ICONS: Record<SiteLinkKind, (props: { className?: string }) => React.ReactNode> = {
  estoque: IconCar,
  whatsapp: IconWhatsApp,
  facebook: IconFacebook,
  olx: IconTag,
  instagram: IconInstagram,
  generic: IconLink,
};

const BASE =
  "group flex min-h-14 w-full items-center gap-3.5 rounded-xl px-4 py-3 font-display text-base font-semibold touch-manipulation transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt active:scale-[0.99]";

/** Estoque = vermelho da loja; WhatsApp = verde dos CTAs de WhatsApp; resto = card neutro. */
const LOOK: Record<SiteLinkKind, string> = {
  estoque:
    "bg-brand text-cream shadow-lg hover:bg-brand-dark active:bg-brand-dark",
  whatsapp:
    "bg-[#25D366] text-asphalt shadow-[0_6px_18px_rgba(0,0,0,0.4)] hover:bg-[#1FB858] active:bg-[#1FB858]",
  facebook: "border border-white/10 bg-white/[0.04] text-cream hover:border-white/25 hover:bg-white/[0.07]",
  olx: "border border-white/10 bg-white/[0.04] text-cream hover:border-white/25 hover:bg-white/[0.07]",
  instagram: "border border-white/10 bg-white/[0.04] text-cream hover:border-white/25 hover:bg-white/[0.07]",
  generic: "border border-white/10 bg-white/[0.04] text-cream hover:border-white/25 hover:bg-white/[0.07]",
};

export function LinksHub({ links }: { links: readonly SiteLink[] }) {
  if (links.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 px-4 py-6 text-center text-sm text-muted">
        Nenhum link disponível por enquanto.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {links.map((link, index) => {
        const kind = siteLinkKind(link.href);
        const Icon = ICONS[kind];
        const internal = isInternalHref(link.href);
        const highlighted = kind === "estoque" || kind === "whatsapp";
        return (
          <li key={`${index}-${link.href}`}>
            {/* <a> simples: links internos abrem na mesma aba e a página não carrega rastreadores. */}
            <a
              href={siteLinkHref(link)}
              {...(internal
                ? {}
                : { target: "_blank", rel: "noopener noreferrer" })}
              className={`${BASE} ${LOOK[kind]}`}
            >
              <Icon className="h-6 w-6 shrink-0" />
              <span className="min-w-0 flex-1 break-words">{link.label}</span>
              <IconArrowRight
                className={`h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 ${highlighted ? "opacity-80" : "text-muted"}`}
              />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
