import type { Metadata } from "next";
import Link from "next/link";
import { MissingModelForm } from "@/components/site/MissingModelForm";
import { buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { STOCK_FILTER_KEYS } from "@/lib/stock-query";
import {
  wantedVehicleFormCopy,
  type WantedVehicleQuery,
} from "@/lib/wanted-vehicle-page";

export const revalidate = 600;

export const metadata: Metadata = buildPageMetadata({
  title: `Não encontrou o modelo? | ${site.name}`,
  description:
    "Deixa o modelo que você procura. A loja guarda o pedido e te chama quando aparecer.",
  path: "/pedido",
});

type Query = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PedidoPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const raw = await searchParams;
  const params: WantedVehicleQuery = {};
  for (const key of [...STOCK_FILTER_KEYS, "sem"] as const) {
    const value = first(raw[key])?.trim();
    if (value) params[key] = value;
  }
  const copy = wantedVehicleFormCopy(params);

  return (
    <div className="wanted-vehicle-page py-12 lg:py-16" data-wanted-vehicle-page="">
      <div className="wanted-vehicle-sheet">
        <Link
          href={copy.pagePath}
          className="inline-flex items-center py-1 text-xs font-medium uppercase tracking-wider text-muted transition hover:text-cream"
        >
          <span className="mr-2 text-brand" aria-hidden="true">
            ←
          </span>
          Voltar ao estoque
        </Link>
        <div className="mt-6">
          <MissingModelForm
            key={JSON.stringify([copy.contextLabel, copy.initialModel, copy.initialYearMin, copy.initialYearMax, copy.initialPriceMin, copy.initialPriceMax, copy.initialKmMax])}
            idPrefix="pedido"
            rememberDraft
            sourcePage="estoque"
            titleAs="h1"
            contextLabel={copy.contextLabel}
            pagePath={copy.pagePath}
            initialModel={copy.initialModel}
            initialYearMin={copy.initialYearMin}
            initialYearMax={copy.initialYearMax}
            initialPriceMin={copy.initialPriceMin}
            initialPriceMax={copy.initialPriceMax}
            initialKmMax={copy.initialKmMax}
            description={copy.description}
          />
        </div>
      </div>
    </div>
  );
}
