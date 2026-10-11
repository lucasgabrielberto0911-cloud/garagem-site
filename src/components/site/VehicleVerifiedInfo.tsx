import { IconShieldCheck } from "@/components/site/icons";
import { publicPhotoSrc } from "@/lib/public-photo-url";
import { galleryThumbSrc } from "@/lib/stock-query";
import type { PublicVerifiedItem } from "@/lib/vehicle-verified";

/**
 * Pontos verificados daquele exemplar, só os que a loja preencheu. A lista
 * vem pronta de `publicVerifiedItems`; sem item, a ficha nem monta isto.
 * Fotos são as do próprio anúncio (miniatura 480×360, carregamento preguiçoso,
 * proporção fixa para não deslocar o layout).
 */
export function VehicleVerifiedList({
  items,
  alt,
}: {
  items: PublicVerifiedItem[];
  alt: string;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="border-l-2 border-brand/80 pl-3">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-cream">
            {item.label}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-cream/90 [overflow-wrap:anywhere]">
            {item.text}
          </p>
          {item.photos.length > 0 ? (
            <div className="mt-2 grid max-w-sm grid-cols-2 gap-2">
              {item.photos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element -- fotos públicas por /api/fotos, sem cota /_next/image
                <img
                  key={photo.id}
                  src={publicPhotoSrc(galleryThumbSrc(photo))}
                  alt={`${item.label}: ${alt}`}
                  width={480}
                  height={360}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full bg-ink object-cover"
                />
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Versão da coluna esquerda (desktop). No celular entra no dossiê. */
export function VehicleVerifiedSection({
  items,
  alt,
  heading,
}: {
  items: PublicVerifiedItem[];
  alt: string;
  heading: string;
}) {
  return (
    <section
      aria-labelledby="ficha-verificado-titulo"
      className="hidden border-t border-white/10 pt-5 lg:mt-6 lg:block"
    >
      <h2
        id="ficha-verificado-titulo"
        className="flex items-center gap-2 font-display text-base font-semibold text-cream"
      >
        <IconShieldCheck className="h-4 w-4 text-brand" />
        {heading}
      </h2>
      <p className="mt-1 text-xs text-muted">
        Informações da loja sobre este exemplar.
      </p>
      <div className="mt-3">
        <VehicleVerifiedList items={items} alt={alt} />
      </div>
    </section>
  );
}
