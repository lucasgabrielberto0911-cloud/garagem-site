import { site } from "@/lib/site";

type WordmarkSize = "header" | "hero" | "footer" | "splash";

const SIZE: Record<
  WordmarkSize,
  { wrap: string; sua: string; img: string; width: number; height: number }
> = {
  header: {
    wrap: "gap-1.5",
    sua: "text-[15px] tracking-tight sm:text-base lg:text-lg",
    img: "h-9 w-auto max-w-[min(38vw,132px)] object-contain object-left sm:max-w-[140px] lg:h-10 lg:max-w-[148px] xl:max-w-[168px]",
    width: 280,
    height: 50,
  },
  hero: {
    wrap: "flex-col gap-1 sm:gap-1.5",
    sua: "text-lg tracking-[0.28em] sm:text-xl lg:text-2xl",
    img: "h-auto w-[min(70vw,260px)] sm:w-[min(58vw,360px)] lg:w-[380px]",
    width: 480,
    height: 86,
  },
  footer: {
    wrap: "flex-col items-center gap-1.5 lg:items-start",
    sua: "text-sm tracking-[0.28em]",
    img: "h-11 w-auto sm:h-12",
    width: 320,
    height: 58,
  },
  splash: {
    wrap: "flex-col gap-1",
    sua: "text-base tracking-[0.28em] sm:text-lg",
    img: "brand-splash-logo",
    width: 480,
    height: 86,
  },
};

/**
 * Marca comercial visível: "Sua" + wordmark Garagem = Sua Garagem.
 * O arquivo do logo só desenha "Garagem"; o prefixo fecha o nome do site.
 */
export function SiteWordmark({
  size = "header",
  priority = false,
  className = "",
}: {
  size?: WordmarkSize;
  priority?: boolean;
  className?: string;
}) {
  const look = SIZE[size];
  return (
    <span
      className={`inline-flex items-center ${look.wrap} ${className}`}
      aria-label={site.name}
    >
      <span
        className={`font-display font-bold uppercase text-brand ${look.sua}`}
        aria-hidden="true"
      >
        Sua
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element -- wordmark estático, sem cota /_next/image */}
      <img
        src="/branding/logo-wordmark.webp"
        alt=""
        width={look.width}
        height={look.height}
        decoding="async"
        fetchPriority={priority ? "high" : "low"}
        className={look.img}
      />
    </span>
  );
}
