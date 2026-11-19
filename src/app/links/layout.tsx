import Link from "next/link";
import { site } from "@/lib/site";

/**
 * Layout mínimo da página de bio: sem cabeçalho, menu inferior, WhatsApp
 * flutuante nem chat (o grupo `(site)` injeta tudo isso). Os botões são o foco.
 */
export default function LinksLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative isolate flex min-h-app-screen flex-col overflow-x-clip bg-asphalt px-4 pb-[max(1.75rem,env(safe-area-inset-bottom,0px))] pt-[max(1.75rem,env(safe-area-inset-top,0px))] sm:px-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,rgba(217,21,25,0.22),transparent_70%)]"
      />
      <main className="mx-auto w-full max-w-[30rem] flex-1">{children}</main>
      <footer className="mx-auto mt-10 flex w-full max-w-[30rem] items-center justify-between gap-3 border-t border-white/15 pt-4 text-xs text-cream/75">
        <span>
          © {new Date().getFullYear()} {site.name}
        </span>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-cream/85 underline-offset-4 transition hover:text-cream hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Ir ao site
        </Link>
      </footer>
    </div>
  );
}
