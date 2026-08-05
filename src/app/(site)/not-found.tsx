import { ButtonLink, WhatsAppButton } from "@/components/site/ui";

export default function SiteNotFound() {
  return (
    <div className="px-4 py-20 text-center sm:px-6 lg:py-28">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
        Erro 404
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
        Página não encontrada
      </h1>
      <div className="mx-auto mt-5 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
      <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted">
        O link pode estar desatualizado ou o veículo já foi vendido. Veja o que
        temos disponível agora.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/estoque" size="lg">
          Ver estoque
        </ButtonLink>
        <WhatsAppButton size="lg" variant="outline">
          WhatsApp
        </WhatsAppButton>
      </div>
    </div>
  );
}
