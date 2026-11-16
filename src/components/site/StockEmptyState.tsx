"use client";

import Link from "next/link";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import { WhatsAppButton } from "@/components/site/ui";
import { SiteLeadHit } from "@/lib/funnel-events";
import type { StockPageResult } from "@/lib/stock-query";
import type { StockEmptyWhatsAppCta } from "@/lib/stock-waitlist";

export function StockEmptyState({
  error,
  filtered,
  loading,
  queryText,
  suggestions,
  clearQueryHref,
  suggestionHref,
  searchString,
  emptyWhatsApp,
}: {
  error: string;
  filtered: boolean;
  loading: boolean;
  queryText?: string;
  suggestions?: StockPageResult["suggestions"];
  clearQueryHref: string;
  suggestionHref: (query: string) => string;
  searchString: string;
  emptyWhatsApp: StockEmptyWhatsAppCta;
}) {
  return (
    <div data-stock-empty="" className="mx-auto max-w-2xl rounded-xl border border-white/20 bg-ink px-4 py-6 text-center sm:px-6 sm:py-10">
      <p className="font-display text-lg font-semibold text-cream [overflow-wrap:anywhere]">
        {error
          ? "Não foi possível carregar o estoque"
          : filtered
            ? suggestions?.length && queryText ? `Não encontramos “${queryText}”.` : "Nenhum veículo com esses filtros"
            : "Estoque sendo montado"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-cream/80">
        {error
          ? "Tente novamente em alguns instantes. Se preferir, fale conosco no WhatsApp."
          : filtered
            ? suggestions?.length ? "Pode ter sido só a escrita do nome. Experimente uma opção abaixo, mantendo os seus filtros." : "Você pode retirar um filtro ou ver todos os veículos. Se preferir, conta pra gente o que você procura no WhatsApp."
            : "Estamos selecionando os próximos veículos. Diga o que você procura que buscamos para você."}
      </p>
      {!loading && !error && suggestions?.length ? (
        <div className="mt-5 border-y border-white/20 py-4" data-stock-search-suggestions="">
          <p className="text-sm font-semibold text-cream">Você quis dizer?</p>
          <p className="mt-1 text-xs leading-relaxed text-cream/75">Os outros filtros continuam iguais.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            {suggestions.map((suggestion) => (
              <Link
                key={suggestion.query}
                href={suggestionHref(suggestion.query)}
                prefetch={false}
                className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-brand/40 bg-brand/10 px-4 py-3 text-left text-sm text-cream transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="min-w-0 whitespace-normal [overflow-wrap:normal]">{suggestion.query}</span>
                <span className="shrink-0 text-xs text-cream/75">
                  {suggestion.count} {suggestion.count === 1 ? "veículo" : "veículos"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {filtered && !error ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {queryText ? (
            <Link
              href={clearQueryHref}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-brand/50 bg-brand/10 px-4 py-3 text-sm font-semibold text-cream transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-auto"
            >
              Retirar só o texto da busca
            </Link>
          ) : null}
          <Link
            href="/estoque"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-white/25 px-4 py-3 text-sm font-semibold text-cream transition hover:border-brand hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-auto"
          >
            Ver todos os veículos
          </Link>
        </div>
      ) : null}
      <div className="mt-5 flex flex-col items-center gap-3">
        <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          <SiteLeadHit
            contentName="Avise-me"
            searchString={filtered ? searchString || undefined : undefined}
          >
            <WhatsAppButton
              trackingLabel={emptyWhatsApp.trackingLabel}
              campaign={emptyWhatsApp.campaign}
              message={emptyWhatsApp.message}
              variant="solid"
            >
              {emptyWhatsApp.label}
            </WhatsAppButton>
          </SiteLeadHit>
          {!error ? (
            <ChatOpenButton
              source={filtered ? "estoque-filtro-vazio" : "estoque-vazio"}
              prompt={
                searchString
                  ? `Quero ajuda para encontrar: ${searchString}`
                  : "Quero ajuda para escolher um veículo"
              }
              variant="outline"
            />
          ) : null}
        </div>
        <p className="max-w-md text-xs leading-relaxed text-cream/80">
          {filtered
            ? "Abre o WhatsApp com o que você filtrou, para avisar quando chegar."
            : "Abre o WhatsApp para você dizer o que procura."}
        </p>
      </div>
    </div>
  );
}
