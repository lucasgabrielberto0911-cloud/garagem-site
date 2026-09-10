import { site } from "@/lib/site";

type WordmarkSize = "header" | "hero" | "footer" | "splash";

const SIZE: Record<
  WordmarkSize,
  { img: string; width: number; height: number }
> = {
  header: {
    img: "h-9 w-auto max-w-[min(46vw,160px)] object-contain object-left sm:max-w-[168px] lg:h-10 lg:max-w-[168px] xl:max-w-[196px]",
    width: 280,
    height: 50,
  },
  hero: {
    img: "h-auto w-[min(70vw,260px)] sm:w-[min(58vw,360px)] lg:w-[380px]",
    width: 480,
    height: 86,
  },
  footer: {
    img: "h-11 w-auto sm:h-12",
    width: 320,
    height: 58,
  },
  splash: {
    img: "brand-splash-logo",
    width: 480,
    height: 86,
  },
};

/**
 * Wordmark visível: só o logo Garagem. O nome comercial "Sua Garagem"
 * fica em aria-label, titles e metadados — sem prefixo "SUA" no chrome.
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
      className={`inline-flex items-center ${className}`.trim()}
      aria-label={site.name}
    >
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
