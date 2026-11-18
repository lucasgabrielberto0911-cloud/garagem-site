import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { IconClock, IconMapPin } from "@/components/site/icons";
import { TradeForm } from "@/components/site/TradeForm";
import { Container, PageHeader } from "@/components/site/ui";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { getPublicSite } from "@/lib/site-settings";
import {
  toTradeInterestVehicle,
  type TradeInterestVehicle,
} from "@/lib/trade-whatsapp";
import { getVehicleByParam } from "@/lib/vehicles";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Avaliação de troca pelo WhatsApp | ${site.name}`,
  description: `Tem carro pra dar na troca? Envie os dados básicos do seu veículo pelo WhatsApp sem cadastro na ${site.name}. Atendemos Linhares, Aracruz e Grande Vitória.`,
  path: "/troca",
});

const STEPS = [
  {
    title: "Informe os dados básicos",
    text: "Marca, modelo, ano, km, câmbio e estado geral — sem cadastro nem dados pessoais.",
  },
  {
    title: "Abra a conversa pronta",
    text: "O botão monta a mensagem organizada e abre direto no nosso WhatsApp.",
  },
  {
    title: "Combinamos a avaliação",
    text: "Analisamos o seu veículo e alinhamos a proposta na troca com transparência.",
  },
] as const;

async function resolveInterestVehicle(
  carroParam?: string,
): Promise<TradeInterestVehicle | null> {
  const slug = carroParam?.trim();
  if (!slug) return null;
  try {
    const vehicle = await getVehicleByParam(slug);
    return toTradeInterestVehicle(vehicle);
  } catch {
    return null;
  }
}

export default async function TrocaPage({
  searchParams,
}: {
  searchParams: Promise<{ carro?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawCarro = Array.isArray(query.carro) ? query.carro[0] : query.carro;

  const [interestVehicle, publicSite] = await Promise.all([
    resolveInterestVehicle(rawCarro),
    getPublicSite(),
  ]);

  return (
    <div data-clear-fab="" className="lg:py-12">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Avaliação de troca", path: "/troca" },
        ])}
      />
      <Container className="pt-5 lg:pt-0">
        <div className="lg:grid lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] lg:items-start lg:gap-x-10 xl:gap-x-14">
          <div className="clear-fab-screen lg:contents">
            <div className="lg:col-span-2">
              <PageHeader
                compact
                eyebrow="Avaliação de troca"
                title="Tem carro pra dar na troca?"
                description="Preencha os dados do seu veículo e envie direto pelo WhatsApp. Sem cadastro, sem upload de fotos e sem compromisso."
              />
            </div>

            <aside className="mt-4 space-y-4 lg:sticky lg:top-24 lg:mt-10">
              <div>
                <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-light">
                  Como funciona
                </h2>
                <ol className="mt-3 grid gap-1.5">
                  {STEPS.map(({ title, text }, index) => (
                    <li
                      key={title}
                      className="flex gap-3 border border-white/10 bg-ink px-3.5 py-3"
                    >
                      <span className="font-display text-sm font-bold leading-5 text-brand-light">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-display text-sm font-semibold text-cream">
                          {title}
                        </h3>
                        <p className="mt-1 text-sm leading-snug text-muted">
                          {text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="border border-white/10 bg-ink px-3.5 py-3 text-sm text-cream/85">
                <p className="flex items-start gap-2 font-display text-xs font-semibold uppercase tracking-[0.14em] text-brand-light">
                  <IconMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Atendimento
                </p>
                <p className="mt-2 font-medium text-cream">
                  Atendemos Linhares, Aracruz e Grande Vitória
                </p>
                <p className="mt-1 text-muted">
                  Combinamos o atendimento pelo WhatsApp.
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                  <IconClock className="h-3.5 w-3.5 shrink-0 text-brand-light" />
                  <span>{publicSite.hours}</span>
                </p>
              </div>
            </aside>
          </div>

          <section className="mt-6 lg:mt-10">
            <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
              Dados do seu veículo
            </h2>
            <div
              className="mt-3 h-0.5 w-16 bg-brand-gradient"
              aria-hidden="true"
            />
            <div className="mt-4">
              <TradeForm
                key={interestVehicle?.id ?? "sem-carro"}
                interestVehicle={interestVehicle}
              />
            </div>
          </section>
        </div>
      </Container>
    </div>
  );
}
