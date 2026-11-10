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
    <div className="flex min-h-app-screen flex-col bg-asphalt px-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-[max(2rem,env(safe-area-inset-top,0px))]">
      <main className="mx-auto w-full max-w-[28rem] flex-1">{children}</main>
      <footer className="mx-auto mt-10 flex w-full max-w-[28rem] items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-muted">
        <span>
          © {new Date().getFullYear()} {site.name}
        </span>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-cream/80 underline-offset-4 transition hover:text-cream hover:underline"
        >
          Ir ao site
        </Link>
      </footer>
    </div>
  );
}
