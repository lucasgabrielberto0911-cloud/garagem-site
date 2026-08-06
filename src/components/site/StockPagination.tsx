import Link from "next/link";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  /** Query string sem `page` — ex.: `?q=honda&sort=recentes` ou `""`. */
  baseQuery: string;
};

function hrefFor(page: number, baseQuery: string) {
  const params = new URLSearchParams(
    baseQuery.startsWith("?") ? baseQuery.slice(1) : baseQuery,
  );
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/estoque?${qs}` : "/estoque";
}

export function StockPagination({ page, totalPages, total, baseQuery }: Props) {
  if (totalPages <= 1 || total === 0) return null;

  const pages = visiblePages(page, totalPages);

  return (
    <nav
      aria-label="Paginação do estoque"
      className="mt-8 flex flex-col items-center gap-3"
    >
      <p className="text-xs text-muted">
        Página {page} de {totalPages}
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          <PageLink
            href={hrefFor(page - 1, baseQuery)}
            disabled={page <= 1}
            label="Anterior"
          />
        </li>
        {pages.map((item, index) =>
          item === "…" ? (
            <li key={`e-${index}`} className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={hrefFor(item, baseQuery)}
                aria-current={item === page ? "page" : undefined}
                className={`inline-flex min-h-[40px] min-w-[40px] items-center justify-center border px-2 text-sm transition touch-manipulation ${
                  item === page
                    ? "border-brand bg-brand/15 text-cream"
                    : "border-white/15 text-muted hover:border-brand hover:text-cream"
                }`}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        <li>
          <PageLink
            href={hrefFor(page + 1, baseQuery)}
            disabled={page >= totalPages}
            label="Próxima"
          />
        </li>
      </ul>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="inline-flex min-h-[40px] items-center border border-white/10 px-3 text-xs text-muted/50">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex min-h-[40px] items-center border border-white/15 px-3 text-xs text-cream transition hover:border-brand touch-manipulation"
    >
      {label}
    </Link>
  );
}

function visiblePages(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const items: Array<number | "…"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("…");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < total - 1) items.push("…");
  items.push(total);
  return items;
}
