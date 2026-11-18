import Link from "next/link";
import { StockEmptyState } from "@/components/site/StockEmptyState";
import { StockInfiniteList } from "@/components/site/StockInfiniteList";
import { stockEmptyWhatsAppCta } from "@/lib/stock-waitlist";
import { STOCK_PAGE_SIZE, type StockPageResult } from "@/lib/stock-query";
import {
  WANTED_VEHICLE_BUTTON_LABEL,
  WANTED_VEHICLE_PATH,
} from "@/lib/wanted-vehicle-page";

/**
 * `/estoque` é só a lista de carros (ISR, sem filtros). Parâmetros de busca de links antigos
 * (`?marca=…`) são ignorados: a página mostra o estoque todo, na ordem padrão.
 */
export function EstoqueBrowse({ initialStock }: { initialStock: StockPageResult }) {
  const { vehicles, total } = initialStock;
  const failed = Boolean(initialStock.error);

  return (
    <>
      <p
        role="status"
        aria-atomic="true"
        className="stock-count mb-3 text-left text-sm font-medium text-cream"
      >
        {failed
          ? "Não foi possível carregar o estoque"
          : `${total} ${total === 1 ? "veículo no estoque" : "veículos no estoque"}`}
      </p>

      <div data-estoque-list="">
        <StockInfiniteList
          initialVehicles={vehicles}
          total={total}
          pageSize={initialStock.pageSize ?? STOCK_PAGE_SIZE}
          query={{}}
          returnTo="/estoque"
          empty={
            <StockEmptyState
              error={failed ? "erro" : ""}
              emptyWhatsApp={stockEmptyWhatsAppCta({ filtered: false, waitlistQuery: "" })}
            />
          }
        />
      </div>

      <div className="stock-next-vehicle">
        <Link
          href={WANTED_VEHICLE_PATH}
          className="inline-flex min-h-14 max-w-full items-center justify-center border border-white/20 bg-ink px-5 py-3 text-center font-display text-base font-semibold leading-snug text-cream transition hover:border-brand hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {WANTED_VEHICLE_BUTTON_LABEL}
        </Link>
      </div>
    </>
  );
}
