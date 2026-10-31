import { publicCardFacts } from "@/lib/public-card-facts";
import { formatBrandName, formatModelName } from "@/lib/format";

export type ListingPreviewProps = {
  brand: string;
  model: string;
  version?: string | null;
  yearModel?: number | null;
  km?: number | null;
  transmission?: string | null;
  price?: number | null;
  status?: string | null;
  /** Foto de capa do estado local do formulário (ainda não salva). */
  coverUrl?: string;
};

const BADGES: Record<string, string> = {
  reservado: "Reservado",
  vendido: "Vendido",
};

/**
 * Prévia do card como o cliente vê no site. Versão só visual do admin:
 * não busca dados, não tem link, favorito nem WhatsApp, e nunca mostra a cidade.
 */
export function ListingPreview(props: ListingPreviewProps) {
  const card = publicCardFacts({
    brand: props.brand,
    model: props.model,
    version: props.version,
    yearModel: props.yearModel,
    km: props.km,
    transmission: props.transmission,
    price: props.price,
    status: props.status,
  });
  const badge = props.status ? BADGES[props.status] : undefined;
  return (
    <article
      aria-label="Prévia do anúncio"
      data-testid="listing-preview"
      className="mx-auto w-full max-w-xs overflow-hidden border border-white/10 bg-ink"
    >
      <div className="relative aspect-[4/3] bg-asphalt">
        {props.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            Sem foto de capa
          </span>
        )}
        {badge ? (
          <span className="absolute left-2 top-2 bg-white/15 px-2 py-0.5 text-xs font-semibold text-cream">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        {props.brand ? (
          <p className="text-xs uppercase tracking-wider text-muted">
            {formatBrandName(props.brand)}
          </p>
        ) : null}
        <p className="font-display text-base font-semibold text-cream">
          {props.model ? formatModelName(props.model) : "Seu próximo anúncio"}
        </p>
        {card.version ? (
          <p className="text-sm text-muted">{card.version}</p>
        ) : null}
        {card.facts.length ? (
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {card.facts.map((fact) => (
              <li
                key={fact.label}
                className="border border-white/10 px-2 py-0.5 text-xs text-muted"
              >
                {fact.value}
              </li>
            ))}
          </ul>
        ) : null}
        {card.priceLabel ? (
          <p className="pt-1 font-display text-lg font-bold text-brand-light">
            {card.priceLabel}
          </p>
        ) : null}
      </div>
    </article>
  );
}
