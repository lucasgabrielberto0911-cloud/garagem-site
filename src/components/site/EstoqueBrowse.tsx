"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import { MissingModelForm } from "@/components/site/MissingModelForm";
import { SiteErrorNotice } from "@/components/site/SiteErrorNotice";
import { StockInfiniteList } from "@/components/site/StockInfiniteList";
import { StockReturnCapture } from "@/components/site/StockReturnCapture";
import { VehicleCardSkeletonGrid } from "@/components/site/VehicleCardSkeleton";
import { HideStockCardInterest } from "@/components/site/HideStockCardInterest";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { SiteLeadHit, StockSearchPixel } from "@/components/site/VehiclePixel";
import { WhatsAppButton } from "@/components/site/ui";
import { formatStockWaitlistQuery, stockEmptyWhatsAppCta } from "@/lib/stock-waitlist";
import {
  parseStockFilters,
  STOCK_FILTER_KEYS,
  STOCK_PAGE_SIZE,
  stockSortLabel,
  stockViewNeedsFetch,
  type StockPageResult,
} from "@/lib/stock-query";
import { stockSearchString } from "@/lib/meta-pixel";

export type EstoqueSearchParams = Partial<
  Record<(typeof STOCK_FILTER_KEYS)[number] | "sort" | "page", string>
>;

function paramsToRecord(params: URLSearchParams): EstoqueSearchParams {
  const record: EstoqueSearchParams = {};
  for (const key of [...STOCK_FILTER_KEYS, "sort"] as const) {
    const value = params.get(key);
    if (value) record[key] = value;
  }
  return record;
}

function buildReturnTo(params: EstoqueSearchParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || !value) continue;
    search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/estoque?${qs}` : "/estoque";
}

function stockQuery(params: EstoqueSearchParams) {
  return {
    q: params.q,
    category: params.category,
    brand: params.brand,
    model: params.model,
    transmission: params.transmission,
    fuel: params.fuel,
    color: params.color,
    accessory: params.accessory,
    laudo: params.laudo,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    minYear: params.minYear,
    maxYear: params.maxYear,
    maxKm: params.maxKm,
    city: params.city,
    sort: params.sort,
  };
}

function hasActiveFilters(params: EstoqueSearchParams) {
  return STOCK_FILTER_KEYS.some((key) => Boolean(params[key]));
}

export function EstoqueBrowseFallback({
  stock,
}: {
  stock?: StockPageResult;
}) {
  const total = stock?.total ?? 0;
  const vehicles = stock?.vehicles ?? [];

  return (
    <>
      <p className="mt-5 text-center text-xs uppercase tracking-wider text-muted lg:mt-0 lg:text-left">
        {vehicles.length > 0
          ? `${total} ${total === 1 ? "veículo no estoque" : "veículos no estoque"} · sem filtros${
              total > vehicles.length ? " · role para ver todos" : ""
            }`
          : "Atualizando o estoque…"}
      </p>
      <div className="mt-4">
        {vehicles.length > 0 ? (
          <StockReturnCapture returnTo="/estoque">
            <HideStockCardInterest>
              <VehicleGrid
                vehicles={vehicles}
                priorityCount={2}
                returnTo="/estoque"
                whatsappCampaign="estoque"
              />
            </HideStockCardInterest>
          </StockReturnCapture>
        ) : (
          <VehicleCardSkeletonGrid count={6} />
        )}
      </div>
    </>
  );
}

/**
 * `/estoque` sem query é ISR. Com filtros, o cliente busca `/api/estoque`
 * (já cacheada) e preserva a URL.
 */
export function EstoqueBrowse({
  initialStock,
}: {
  initialStock: StockPageResult;
}) {
  const searchParams = useSearchParams();
  const params = useMemo(
    () => paramsToRecord(searchParams),
    [searchParams],
  );
  const filtered = hasActiveFilters(params);
  const remote = stockViewNeedsFetch(params);
  const filterKey = JSON.stringify(stockQuery(params));
  const [stock, setStock] = useState<StockPageResult>(initialStock);
  const [loading, setLoading] = useState(remote);
  const requestKey = remote ? filterKey : "";
  const [requestKeySeen, setRequestKeySeen] = useState(requestKey);
  // A troca de URL precisa esconder a lista anterior no mesmo render.
  // Senão a grade infinita guarda os carros do filtro antigo ao limpar.
  if (requestKeySeen !== requestKey) {
    setRequestKeySeen(requestKey);
    setLoading(remote);
  }
  const shown = remote ? stock : initialStock;
  const requestId = useRef(0);

  useEffect(() => {
    if (!remote) {
      setStock(initialStock);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    const controller = new AbortController();
    setLoading(true);

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(stockQuery(params))) {
      if (value) query.set(key, value);
    }
    query.set("page", "1");
    query.set("pageSize", String(STOCK_PAGE_SIZE));

    fetch(`/api/estoque?${query.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as Partial<StockPageResult> & {
          vehicles?: StockPageResult["vehicles"];
          error?: string;
        };
        if (id !== requestId.current) return;
        setStock({
          vehicles: data.vehicles ?? [],
          total: data.total ?? 0,
          page: data.page ?? 1,
          pageSize: data.pageSize ?? STOCK_PAGE_SIZE,
          totalPages: data.totalPages ?? 1,
          error: data.error,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || id !== requestId.current) return;
        console.error("[estoque] falha ao filtrar:", error);
        setStock({
          vehicles: [],
          total: 0,
          page: 1,
          pageSize: STOCK_PAGE_SIZE,
          totalPages: 1,
          error: "Não foi possível carregar o estoque.",
        });
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });

    return () => controller.abort();
  }, [filterKey, remote, initialStock, params]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("garagem:estoque-scroll");
      if (!saved) return;
      sessionStorage.removeItem("garagem:estoque-scroll");
      const top = Number(saved);
      if (Number.isFinite(top) && top > 0) {
        window.requestAnimationFrame(() => window.scrollTo(0, top));
      }
    } catch {
      // private mode
    }
  }, []);

  const returnTo = buildReturnTo(params);
  const query = useMemo(() => stockQuery(params), [params]);
  const filters = parseStockFilters(params, { page: 1 });
  const searchString = stockSearchString(params);
  const waitlistQuery = formatStockWaitlistQuery(params);
  const emptyWhatsApp = stockEmptyWhatsAppCta({
    filtered,
    waitlistQuery,
  });
  const resultIds = shown.vehicles.map((vehicle) => vehicle.id);

  return (
    <>
      {!loading && filtered && searchString ? (
        <StockSearchPixel
          active
          searchString={searchString}
          contentIds={resultIds}
        />
      ) : null}
      {shown.error ? (
        <div className="mt-6">
          <SiteErrorNotice message="O estoque pode estar incompleto por uma falha temporária de conexão. Atualize a página em instantes." />
        </div>
      ) : null}

      <p className="mt-5 text-center text-xs uppercase tracking-wider text-muted lg:mt-0 lg:text-left">
        {loading
          ? "Atualizando o estoque…"
          : filtered
            ? `${shown.total} ${shown.total === 1 ? "veículo encontrado" : "veículos encontrados"} · ${stockSortLabel(params.sort)}`
            : `${shown.total} ${shown.total === 1 ? "veículo no estoque" : "veículos no estoque"} · ${stockSortLabel(params.sort)}`}
        {!loading && shown.total > shown.vehicles.length
          ? " · role para ver todos"
          : ""}
      </p>

      <div className="mt-4" data-estoque-list="" aria-live="polite">
        {loading ? (
          <VehicleCardSkeletonGrid count={6} />
        ) : (
          <StockInfiniteList
            key={filterKey}
            initialVehicles={shown.vehicles}
            total={shown.total}
            pageSize={shown.pageSize ?? filters.pageSize ?? STOCK_PAGE_SIZE}
            query={query}
            returnTo={returnTo}
            empty={
              <div className="mx-auto max-w-2xl border border-dashed border-white/15 bg-ink/40 px-6 py-12 text-center">
                <p className="font-display text-lg font-semibold text-cream">
                  {shown.error
                    ? "Não foi possível carregar o estoque"
                    : filtered
                      ? "Nenhum veículo com esses filtros"
                      : "Estoque sendo montado"}
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                  {shown.error
                    ? "Tente novamente em alguns instantes. Se preferir, fale conosco no WhatsApp."
                    : filtered
                      ? waitlistQuery
                        ? `Não tem ${waitlistQuery} agora. Me avisa no WhatsApp — a gente chama quando entrar.`
                        : "Não tem essa combinação agora. Me avisa no WhatsApp o que você procura — a gente chama quando entrar."
                      : "Estamos selecionando os próximos veículos. Diga o que você procura que buscamos para você."}
                </p>
                <div className="mt-5 flex flex-col items-center gap-3">
                  <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
                  <SiteLeadHit
                    contentName="Avise-me"
                    searchString={
                      filtered ? searchString || undefined : undefined
                    }
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
                  {!shown.error ? (
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
                  <p className="max-w-md text-[11px] leading-relaxed text-muted">
                    {filtered
                      ? "Abre o WhatsApp com o que você filtrou, para avisar quando chegar."
                      : "Abre o WhatsApp para você dizer o que procura."}
                  </p>
                </div>
              </div>
            }
          />
        )}
      </div>

      <div className="mt-10">
        <MissingModelForm
          key={filterKey}
          idPrefix="estoque"
          sourcePage="estoque"
          contextLabel={filtered ? waitlistQuery : ""}
          pagePath={returnTo}
          initialModel={params.q?.trim() || params.model?.trim() || ""}
          initialYearMin={params.minYear ?? ""}
          initialYearMax={params.maxYear ?? ""}
          initialPriceMin={params.minPrice ?? ""}
          initialPriceMax={params.maxPrice ?? ""}
          initialKmMax={params.maxKm ?? ""}
          description={
            !loading && shown.vehicles.length === 0
              ? filtered && waitlistQuery
                ? `Não tem ${waitlistQuery} agora. Deixa o modelo e seu contato — a loja guarda o pedido.`
                : "Deixa o modelo que você procura. A loja guarda o pedido e te chama quando aparecer."
              : "Se o modelo não está na lista, deixa o que você procura. A loja guarda o pedido."
          }
        />
      </div>
    </>
  );
}
