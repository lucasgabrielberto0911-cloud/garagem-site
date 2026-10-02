import { VehicleImage } from "@/components/VehicleImage";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { RememberVehicleSnapshot } from "@/components/site/RememberVehicleSnapshot";
import { StockVehicleLink } from "@/components/site/StockVehicleLink";
import { formatBrandName, formatModelName } from "@/lib/format";
import { publicCardFacts, type PublicCardFact } from "@/lib/public-card-facts";
import {
  CARD_SIZES,
  coverSrc,
  coverSrcSet,
  type VehicleCardRecord,
} from "@/lib/stock-query";
import { formatVehicleDisplay } from "@/lib/vehicle-display";

export type VehicleCardData = VehicleCardRecord;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  reservado: { label: "Reservado", className: "bg-brand-orange text-asphalt" },
  vendido: { label: "Vendido", className: "bg-white/15 text-cream" },
};

/**
 * Card de servidor: só o favorito e o link hidratam no cliente.
 * O mesmo card entra na home, no estoque, nos favoritos e na faixa da ficha.
 * Sem atalho de WhatsApp — a conversa fica na ficha e no chat.
 */
export function VehicleCard({
  vehicle,
  priority = false,
  returnTo,
  showDestaque = false,
  largePhoto = false,
}: {
  vehicle: VehicleCardData;
  priority?: boolean;
  returnTo?: string;
  showDestaque?: boolean;
  /** Foto 4:3 no celular — o maior retângulo nas duas colunas do estoque. */
  largePhoto?: boolean;
}) {
  const display = formatVehicleDisplay(vehicle);
  const card = publicCardFacts(vehicle);
  const cover = coverSrc(vehicle.photos);
  const coverSet = coverSrcSet(vehicle.photos);
  const badge = STATUS_BADGE[vehicle.status];
  const href = display.path;
  const ariaLabel = card.priceLabel
    ? `${display.titleWithYear} — ${card.priceLabel}`
    : display.titleWithYear;

  const photoClass = largePhoto
    ? "relative aspect-[4/3] overflow-hidden bg-asphalt sm:aspect-[16/10]"
    : "relative aspect-[16/10] overflow-hidden bg-asphalt";

  return (
    <article
      className={`vehicle-card card-lift group relative flex h-full flex-col overflow-hidden border border-white/10 bg-ink touch-manipulation focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand ${
        largePhoto ? "vehicle-card-stock" : ""
      }`}
    >
      <RememberVehicleSnapshot
        vehicle={{
          id: vehicle.id,
          category: vehicle.category,
          brand: vehicle.brand,
          model: vehicle.model,
          version: vehicle.version,
          yearModel: vehicle.yearModel,
          km: vehicle.km,
          price: vehicle.price,
          transmission: vehicle.transmission,
          fuel: vehicle.fuel,
          status: vehicle.status,
          featured: vehicle.featured,
          color: vehicle.color,
          locationCity: vehicle.locationCity ?? null,
          updatedAt:
            vehicle.updatedAt instanceof Date
              ? vehicle.updatedAt.toISOString()
              : vehicle.updatedAt ?? null,
          photos: vehicle.photos,
        }}
      />

      <StockVehicleLink
        href={href}
        returnTo={returnTo}
        ariaLabel={ariaLabel}
        className="absolute inset-0 z-10"
      >
        <span className="sr-only">{ariaLabel}</span>
      </StockVehicleLink>

      <div className={photoClass} data-vehicle-photo="">
        <VehicleImage
          src={cover}
          alt={display.titleWithYear}
          fill
          width={480}
          height={300}
          sizes={CARD_SIZES}
          srcSet={coverSet}
          priority={priority}
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-asphalt/70 via-transparent to-transparent"
          aria-hidden="true"
        />

        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {badge ? (
            <span
              className={`px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}
            >
              {badge.label}
            </span>
          ) : null}
          {!cover ? (
            <span className="bg-white/15 px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-cream">
              Sem foto
            </span>
          ) : null}
        </div>
        {showDestaque ? (
          <span className="absolute bottom-1.5 left-2 bg-brand px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-cream">
            Destaque
          </span>
        ) : null}
      </div>

      <div className="vehicle-card-favorite">
        <FavoriteButton
          vehicleId={vehicle.id}
          label={display.titleWithYear}
          value={vehicle.price}
          make={formatBrandName(vehicle.brand)}
          model={formatModelName(vehicle.model)}
          year={vehicle.yearModel}
          appearance="ghost"
          size="sm"
          className="pointer-events-auto"
        />
      </div>

      <div
        className="flex flex-1 flex-col px-2.5 pb-2 pt-1.5 sm:px-3 sm:pb-2.5 sm:pt-2"
        data-vehicle-body=""
      >
        <div className="min-w-0">
          <h3 className="vehicle-card-title font-display text-[15px] font-semibold text-cream sm:text-base">
            {card.title}
          </h3>
          <CardFacts version={card.version} facts={card.facts} />
        </div>

        <div className="mt-1.5">
          {card.priceLabel ? (
            <p className="vehicle-card-price font-display font-bold leading-none tracking-tight text-brand tabular-nums">
              {card.priceLabel}
            </p>
          ) : null}
          <span className="card-open-label font-display text-[11px] font-semibold uppercase tracking-wide text-cream/85 transition group-hover:text-cream">
            Ver ficha
          </span>
        </div>
      </div>
    </article>
  );
}

/** Largura em px da Sora 600 a 9px. Reticências só cabem depois da palavra. */
const GLYPH_PX: Record<string, number> = {
  " ": 2.05, ".": 2.36, ",": 2.36, "-": 4.54, "/": 3.1, "…": 7.25,
  "0": 6.69, "1": 3.78, "2": 5.56, "3": 5.53, "4": 5.78,
  "5": 5.61, "6": 5.93, "7": 5.17, "8": 5.73, "9": 5.93,
  A: 6.8, B: 6.12, C: 7.16, D: 7.12, E: 5.4, F: 5.04, G: 7.48, H: 7.24, I: 2.83,
  J: 5.76, K: 6.1, L: 4.9, M: 8.28, N: 7.64, O: 7.79, P: 5.76, Q: 7.79, R: 6.3,
  S: 6.2, T: 5.35, U: 7.1, V: 6.37, W: 9.39, X: 6.26, Y: 5.87, Z: 5.89,
  a: 5.17, b: 6.2, c: 5.45, d: 6.2, e: 5.51, f: 3.41, g: 6.08, h: 5.76, i: 2.77,
  j: 2.85, k: 5.16, l: 2.57, m: 8.71, n: 5.76, o: 6.08, p: 6.2, q: 6.2, r: 3.69,
  s: 4.82, t: 3.83, u: 5.65, v: 5.03, w: 7.63, x: 5.04, y: 4.92, z: 4.39,
  á: 5.17, à: 5.17, â: 5.17, ã: 5.17, é: 5.51, ê: 5.51, í: 2.77,
  ó: 6.08, ô: 6.08, õ: 6.08, ú: 5.65, ç: 5.45,
  Á: 6.8, À: 6.8, Â: 6.8, Ã: 6.8, É: 5.4, Ê: 5.4, Í: 2.83,
  Ó: 7.79, Ô: 7.79, Õ: 7.79, Ú: 7.1, Ç: 7.16,
};

function textWidth(value: string) {
  let width = 0;
  for (const char of value) width += GLYPH_PX[char] ?? 5.4;
  return width;
}

/** Cabe no chip. Reticências só depois de uma palavra inteira. */
export function clipChipText(value: string, maxPx = 82) {
  const text = value.replace(/\s+/g, " ").trim();
  if (textWidth(text) <= maxPx) return text;
  const words = text.split(" ");
  let kept = "";
  for (const word of words) {
    const next = kept ? `${kept} ${word}` : word;
    if (textWidth(`${next}…`) > maxPx) break;
    kept = next;
  }
  if (!kept) return text;
  return `${kept}…`;
}

const CHIP_PX = {
  versao: 68,
  ano: 24,
  cidade: 40,
  km: 58,
  cambio: 82,
} as const;

function FactChip({
  fact,
  maxPx,
}: {
  fact?: { label: string; value: string };
  maxPx: number;
}) {
  if (!fact?.value) return <div className="vehicle-card-slot" aria-hidden="true" />;
  const visible = clipChipText(fact.value, maxPx);
  return (
    <div className="vehicle-card-fact">
      <dt className="sr-only">{fact.label}</dt>
      <dd title={fact.value}>
        {visible === fact.value ? (
          fact.value
        ) : (
          <>
            <span className="sr-only">{fact.value}</span>
            <span aria-hidden="true">{visible}</span>
          </>
        )}
      </dd>
    </div>
  );
}

function CardFacts({
  version,
  facts,
}: {
  version: string;
  facts: PublicCardFact[];
}) {
  const byLabel = new Map(facts.map((fact) => [fact.label, fact]));
  return (
    <dl className="vehicle-card-facts">
      <div className="vehicle-card-fact-line vehicle-card-fact-line-main">
        <FactChip
          fact={version ? { label: "Versão", value: version } : undefined}
          maxPx={CHIP_PX.versao}
        />
        <FactChip fact={byLabel.get("Ano")} maxPx={CHIP_PX.ano} />
        <FactChip fact={byLabel.get("Cidade")} maxPx={CHIP_PX.cidade} />
      </div>
      <div className="vehicle-card-fact-line vehicle-card-fact-line-sub">
        <FactChip fact={byLabel.get("Km")} maxPx={CHIP_PX.km} />
        <FactChip fact={byLabel.get("Câmbio")} maxPx={CHIP_PX.cambio} />
      </div>
    </dl>
  );
}
