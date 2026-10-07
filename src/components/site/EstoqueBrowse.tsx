"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
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
import {
  WANTED_VEHICLE_BUTTON_LABEL,
  WANTED_VEHICLE_PATH,
  wantedVehicleHref,
} from "@/lib/wanted-vehicle-page";

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

function NextVehicleLink({ href }: { href: string }) {
  return (
    <div className="stock-next-vehicle">
      <Link
        href={href}
        className="inline-flex min-h-[52px] max-w-full items-center justify-center border border-white/20 bg-ink px-5 py-3 text-center font-display text-sm font-semibold leading-snug text-cream transition hover:border-brand hover:bg-white/5"
      >
        {WANTED_VEHICLE_BUTTON_LABEL}
      </Link>
    </div>
  );
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
      <p
        role="status"
        aria-atomic="true"
        className="stock-count mb-2 mt-3 text-left text-sm font-medium text-cream lg:mb-0 lg:mt-0 lg:text-xs lg:font-normal lg:uppercase lg:tracking-wider lg:text-muted"
      >
        {vehicles.length > 0
          ? `${total} ${total === 1 ? "veículo no estoque" : "veículos no estoque"}`
          : "Atualizando o estoque…"}
        {vehicles.length > 0 ? (
          <span className="hidden lg:inline">
            {` · ${stockSortLabel("recentes")}`}
            {total > vehicles.length ? " · role para ver todos" : ""}
          </span>
        ) : null}
      </p>
      <div className="mt-1 lg:mt-4">
        {vehicles.length > 0 ? (
          <StockReturnCapture returnTo="/estoque">
            <HideStockCardInterest>
              <VehicleGrid
                vehicles={vehicles}
                priorityCount={2}
                returnTo="/estoque"
                photoLayout="stock"
              />
            </HideStockCardInterest>
          </StockReturnCapture>
        ) : (
          <VehicleCardSkeletonGrid count={6} largePhoto />
        )}
      </div>
      <NextVehicleLink href={WANTED_VEHICLE_PATH} />
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
  const [attempt, setAttempt] = useState(0);
  const needsFetch = remote || attempt > 0 || Boolean(initialStock.error);
  const initialKey = JSON.stringify(stockQuery({}));
  const [result, setResult] = useState({
    key: initialKey, stock: initialStock, params: {} as EstoqueSearchParams, version: 0,
  });
  const [request, setRequest] = useState({
    key: filterKey, attempt: 0, loading: needsFetch, error: "",
  });
  const loading = needsFetch && (
    request.key !== filterKey || request.attempt !== attempt || request.loading
  );
  const error = !loading && needsFetch && request.key === filterKey ? request.error : "";
  const shownResult = needsFetch ? result : {
    key: initialKey, stock: initialStock, params: {} as EstoqueSearchParams, version: 0,
  };
  const shown = shownResult.stock;
  const previousResults = (loading || Boolean(error)) && shown.vehicles.length > 0;
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    if (!needsFetch) {
      setResult(current => current.key === initialKey && current.stock === initialStock ? current : {
        key: initialKey, stock: initialStock, params: {}, version: 0,
      });
      return;
    }
    const controller = new AbortController();
    setRequest({ key: filterKey, attempt, loading: true, error: "" });

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(stockQuery(params))) {
      if (value) query.set(key, value);
    }
    query.set("page", "1");
    query.set("pageSize", String(STOCK_PAGE_SIZE));

    fetch(`/api/estoque?${query.toString()}`, {
      headers: { Accept: "application/json" }, signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao carregar o estoque");
        const data = await response.json() as StockPageResult;
        if (data.error || !Array.isArray(data.vehicles) || !Number.isFinite(data.total)) {
          throw new Error("Resposta inválida do estoque");
        }
        if (controller.signal.aborted || id !== requestId.current) return;
        setResult(current => ({
          key: filterKey, params, version: current.version + 1,
          stock: {
            vehicles: data.vehicles, total: data.total, page: data.page ?? 1,
            pageSize: data.pageSize ?? STOCK_PAGE_SIZE, totalPages: data.totalPages ?? 1,
          },
        }));
        setRequest({ key: filterKey, attempt, loading: false, error: "" });
      })
      .catch(() => {
        if (controller.signal.aborted || id !== requestId.current) return;
        // Uma falha não apaga o último conjunto nem vira resultado vazio.
        setRequest({ key: filterKey, attempt, loading: false, error: "Não foi possível atualizar a busca." });
      });

    return () => controller.abort();
  }, [filterKey, needsFetch, attempt, params, initialKey, initialStock]);

  const shownQuery = useMemo(() => stockQuery(shownResult.params), [shownResult.params]);
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
      {!loading && !error && filtered && searchString ? (
        <StockSearchPixel
          active
          searchString={searchString}
          contentIds={resultIds}
        />
      ) : null}
      {error ? (
        <div className="mt-4 border border-brand-orange/40 bg-brand-orange/10 px-4 py-3" role="alert">
          <p className="text-sm text-cream">Não conseguimos atualizar sua busca agora. Seus filtros foram mantidos.</p>
          <button type="button" onClick={() => setAttempt(current => current + 1)}
            className="mt-3 min-h-11 border border-white/25 px-4 text-sm font-semibold text-cream transition hover:border-brand">
            Tentar novamente
          </button>
        </div>
      ) : null}

      <p
        role="status"
        aria-atomic="true"
        className="stock-count mb-2 mt-3 text-left text-sm font-medium text-cream lg:mb-0 lg:mt-0 lg:text-xs lg:font-normal lg:uppercase lg:tracking-wider lg:text-muted"
      >
        {loading
          ? "Atualizando o estoque…"
          : error
            ? "Não foi possível atualizar a busca"
            : filtered
              ? `${shown.total} ${shown.total === 1 ? "veículo encontrado" : "veículos encontrados"}`
              : `${shown.total} ${shown.total === 1 ? "veículo no estoque" : "veículos no estoque"}`}
        {!loading && !error ? (
          <span className="hidden lg:inline">
            {` · ${stockSortLabel(params.sort)}`}
            {shown.total > shown.vehicles.length ? " · role para ver todos" : ""}
          </span>
        ) : null}
      </p>

      {previousResults ? (
        <p className="mb-3 text-xs leading-relaxed text-muted" data-stock-previous-results="">
          {loading ? "Você está vendo os anúncios já carregados enquanto a busca atualiza." : "Os anúncios abaixo são da última lista carregada. Tente novamente para aplicar sua busca."}
        </p>
      ) : null}
      <div className="mt-1 lg:mt-4" data-estoque-list="" aria-live="polite" aria-busy={loading}>
        {loading && shown.vehicles.length === 0 ? (
          <VehicleCardSkeletonGrid count={6} largePhoto />
        ) : (
          <StockInfiniteList
            key={`${shownResult.key}:${shownResult.version}`}
            initialVehicles={shown.vehicles}
            total={shown.total}
            pageSize={shown.pageSize ?? filters.pageSize ?? STOCK_PAGE_SIZE}
            query={shownQuery}
            returnTo={buildReturnTo(shownResult.params)}
            paused={loading || Boolean(error)}
            empty={
              <div data-stock-empty="" className="mx-auto max-w-2xl rounded-xl border border-white/15 bg-ink px-4 py-6 text-center sm:px-6 sm:py-10">
                <p className="font-display text-lg font-semibold text-cream">
                  {error
                    ? "Não foi possível carregar o estoque"
                    : filtered
                      ? "Nenhum veículo com esses filtros"
                      : "Estoque sendo montado"}
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                  {error
                    ? "Tente novamente em alguns instantes. Se preferir, fale conosco no WhatsApp."
                    : filtered
                      ? "Você pode retirar um filtro ou ver todos os veículos. Se preferir, conta pra gente o que você procura no WhatsApp."
                      : "Estamos selecionando os próximos veículos. Diga o que você procura que buscamos para você."}
                </p>
                {filtered && !error ? (
                  <Link
                    href="/estoque"
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-md border border-white/25 px-4 py-3 text-sm font-semibold text-cream transition hover:border-brand hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand sm:w-auto"
                  >
                    Ver todos os veículos
                  </Link>
                ) : null}
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
                  <p className="max-w-md text-[11px] leading-relaxed text-muted">
                    {filtered
                      ? "Abre o WhatsApp com o que você filtrou, para avisar quando chegar."
                      : "Abre o WhatsApp para você dizer o que procura."}
                  </p>
                </div>
                {filtered && params.q ? (
                  <Link
                    href={buildReturnTo({ ...params, q: undefined })}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-white/25 px-4 py-3 text-sm font-semibold text-cream transition hover:border-brand sm:w-auto"
                  >
                    Retirar só o texto da busca
                  </Link>
                ) : null}
              </div>
            }
          />
        )}
      </div>

      <NextVehicleLink
        href={wantedVehicleHref(params, {
          empty: !loading && shown.vehicles.length === 0,
        })}
      />
    </>
  );
}
