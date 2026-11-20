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
  "group flex min-h-[58px] w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 font-display text-base font-semibold touch-manipulation transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt active:scale-[0.99]";

/** Estoque = vermelho da loja; WhatsApp = verde oficial com texto escuro; resto = card elevado. */
const LOOK: Record<SiteLinkKind, string> = {
  estoque:
    "border border-brand-light/40 bg-brand text-white shadow-[0_14px_30px_-10px_rgba(217,21,25,0.6)] hover:-translate-y-0.5 hover:bg-brand-dark active:bg-brand-dark",
  whatsapp:
    "border border-white/15 bg-[#25D366] text-asphalt shadow-[0_14px_30px_-10px_rgba(37,211,102,0.45)] hover:-translate-y-0.5 hover:bg-[#1FB858] active:bg-[#1BA84E]",
  facebook:
    "border border-white/15 bg-ink/95 text-cream shadow-[0_10px_24px_-12px_rgba(0,0,0,0.8)] hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.08]",
  olx:
    "border border-white/15 bg-ink/95 text-cream shadow-[0_10px_24px_-12px_rgba(0,0,0,0.8)] hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.08]",
  instagram:
    "border border-white/15 bg-ink/95 text-cream shadow-[0_10px_24px_-12px_rgba(0,0,0,0.8)] hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.08]",
  generic:
    "border border-white/15 bg-ink/95 text-cream shadow-[0_10px_24px_-12px_rgba(0,0,0,0.8)] hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.08]",
};

const ICON_BADGE: Record<SiteLinkKind, string> = {
  estoque: "bg-white/15 text-white",
  whatsapp: "bg-asphalt/10 text-asphalt",
  facebook: "border border-white/15 bg-white/[0.06] text-cream",
  olx: "border border-brand/35 bg-brand/15 text-brand-light",
  instagram:
    "bg-[radial-gradient(circle_at_30%_110%,#fdf497_0%,#fd5949_45%,#d6249f_62%,#285AEB_90%)] text-white",
  generic: "border border-white/15 bg-white/[0.06] text-cream",
};

export function LinksHub({ links }: { links: readonly SiteLink[] }) {
  if (links.length === 0) {
    return (
      <p className="rounded-2xl border border-white/15 bg-ink px-4 py-6 text-center text-sm text-cream/80 shadow-lg">
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
              <span
                aria-hidden="true"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ICON_BADGE[kind]}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 break-words">{link.label}</span>
              <IconArrowRight
                className={`h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 ${
                  kind === "estoque"
                    ? "text-white/95"
                    : kind === "whatsapp"
                      ? "text-asphalt/90"
                      : "text-cream/70 group-hover:text-cream"
                }`}
              />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
