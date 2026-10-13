import { site } from "@/lib/site";

type WordmarkSize = "header" | "hero" | "footer" | "splash";

const SIZE: Record<
  WordmarkSize,
  { img: string; width: number; height: number; sizes?: string }
> = {
  header: {
    img: "h-9 w-auto max-w-[min(46vw,160px)] object-contain object-left sm:max-w-[168px] lg:h-10 lg:max-w-[168px] xl:max-w-[196px]",
    width: 280,
    height: 50,
    sizes: "(min-width: 1280px) 196px, (min-width: 640px) 168px, min(46vw, 160px)",
  },
  hero: {
    img: "h-auto w-[min(52vw,188px)] sm:w-[min(58vw,360px)] lg:w-[380px]",
    width: 887,
    height: 160,
  },
  footer: {
    img: "h-11 w-auto sm:h-12",
    width: 320,
    height: 58,
    sizes: "(min-width: 640px) 267px, 244px",
  },
  splash: {
    img: "brand-splash-logo",
    width: 480,
    height: 86,
    sizes: "min(72vw, 280px)",
  },
};

/**
 * Wordmark visível: só o logo Garagem. O nome comercial
 * "Garagem" fica em aria-label, titles e metadados.
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
  // O hero conserva a URL usada pelo preload da home. Header, rodapé e splash
  // escolhem arquivos menores por largura/DPR, sem mudar o tamanho visível.
  return (
    <span
      className={`inline-flex items-center ${className}`.trim()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- wordmark estático, sem cota /_next/image */}
      <img
        src={look.sizes ? "/branding/logo-wordmark-320.webp" : "/branding/logo-wordmark.webp"}
        srcSet={look.sizes ? "/branding/logo-wordmark-320.webp 320w, /branding/logo-wordmark-640.webp 640w, /branding/logo-wordmark.webp 887w" : undefined}
        sizes={look.sizes}
        alt={site.name}
        width={look.width}
        height={look.height}
        loading={size === "footer" && !priority ? "lazy" : "eager"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "low"}
        className={look.img}
      />
    </span>
  );
}
