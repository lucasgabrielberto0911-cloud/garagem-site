import type { Metadata } from "next";
import Link from "next/link";
import { LinksHub } from "@/components/site/LinksHub";
import { RealStockPreview } from "@/components/site/RealStockPreview";
import { SiteWordmark } from "@/components/site/SiteWordmark";
import {
  IconArrowRight,
  IconClipboardCheck,
  IconClock,
  IconHandshake,
  IconMapPin,
  IconShieldCheck,
} from "@/components/site/icons";
import { buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { getSiteContent } from "@/lib/site-content";
import { publicSiteLinks } from "@/lib/site-links";
import { getFeaturedVehicles } from "@/lib/vehicles";

// O painel invalida na hora (updateTag + revalidatePath em /admin/site).
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Links da ${site.name}`,
  description: `Estoque, WhatsApp e redes da ${site.name} em um só lugar.`,
  path: "/links",
});

const BRAND_PILLARS = [
  { Icon: IconShieldCheck, label: "Procedência" },
  { Icon: IconClipboardCheck, label: "Revisados" },
  { Icon: IconHandshake, label: "Aceita troca" },
] as const;

export default async function LinksPage() {
  const [{ links }, featured] = await Promise.all([
    getSiteContent(),
    getFeaturedVehicles(4),
  ]);

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-ink via-ink to-asphalt/95 px-5 pb-6 pt-6 text-center shadow-[0_22px_50px_-18px_rgba(0,0,0,0.85)] sm:px-6">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.5 bg-brand-gradient"
        />
        <Link
          href="/"
          aria-label={`${site.name} — ir para o início do site`}
          className="inline-flex min-h-12 items-center justify-center rounded-xl px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-4 focus-visible:ring-offset-ink"
        >
          <SiteWordmark size="hero" priority />
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl">
          {site.name}
        </h1>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand/35 bg-brand/10 px-3 py-1 font-display text-xs font-semibold text-brand-light">
          <IconMapPin className="h-3.5 w-3.5 shrink-0" />
          Linhares, Aracruz e Grande Vitória
        </p>
        <p className="mt-3 text-sm leading-relaxed text-cream/85 sm:text-[15px]">
          Seminovos com procedência. Atendemos Linhares, Aracruz e Grande Vitória · Combinamos o atendimento pelo WhatsApp.
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
          {BRAND_PILLARS.map(({ Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-asphalt/70 px-2 py-2.5"
            >
              <Icon className="h-4 w-4 text-brand-light" />
              <span className="font-display text-[11px] font-semibold leading-tight text-cream/90">
                {label}
              </span>
            </div>
          ))}
        </div>
      </header>

      <section aria-labelledby="links-canais">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2
            id="links-canais"
            className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-light"
          >
            Canais oficiais
          </h2>
          <span className="text-xs text-muted">Toque para abrir</span>
        </div>
        <LinksHub links={publicSiteLinks(links)} />
      </section>

      {featured.length > 0 ? (
        <section
          aria-labelledby="links-estoque"
          className="rounded-2xl border border-white/15 bg-ink/85 p-4 shadow-[0_18px_42px_-16px_rgba(0,0,0,0.8)] sm:p-5"
        >
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-light">
                No estoque agora
              </p>
              <h2
                id="links-estoque"
                className="mt-1 font-display text-lg font-bold tracking-tight text-cream"
              >
                Destaques da {site.name}
              </h2>
            </div>
            <Link
              href="/estoque"
              prefetch={false}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 font-display text-xs font-semibold uppercase tracking-wide text-brand-light transition hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
            >
              Ver todos
              <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <RealStockPreview vehicles={featured} variant="compact" />
        </section>
      ) : null}

      <section
        aria-label="Horário e região de atendimento"
        className="rounded-2xl border border-white/10 bg-ink/60 px-4 py-4 shadow-md sm:px-5"
      >
        <div className="grid gap-3 text-sm text-cream/85 sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand-light">
              <IconClock className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted">
                Horário
              </p>
              <p className="mt-0.5 text-sm font-medium text-cream">
                {site.hours}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand-light">
              <IconMapPin className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted">
                Atendimento
              </p>
              <p className="mt-0.5 text-sm font-medium text-cream">
                Combinado pelo WhatsApp
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
