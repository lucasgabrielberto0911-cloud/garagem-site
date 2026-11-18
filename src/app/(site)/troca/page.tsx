import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { IconClock, IconMapPin } from "@/components/site/icons";
import { TradeForm } from "@/components/site/TradeForm";
import { Container } from "@/components/site/ui";
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
  description: `Tem carro pra dar na troca? Responda passo a passo e mande pelo WhatsApp sem cadastro na ${site.name}. Atendemos Linhares, Aracruz e Grande Vitória.`,
  path: "/troca",
});

const STEPS = [
  {
    title: "Responda um passo por vez",
    text: "Qual é o seu carro, ano, km, câmbio e como ele está hoje. Sem cadastro e sem enviar foto.",
  },
  {
    title: "Confira tudo antes de mandar",
    text: "No fim você vê o resumo arrumado e pode mudar qualquer resposta com um toque.",
  },
  {
    title: "Fale direto no WhatsApp",
    text: "O botão abre a conversa pronta para combinarmos a avaliação com transparência.",
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
    <div data-clear-fab="" className="clear-fab-screen lg:py-12">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Avaliação de troca", path: "/troca" },
        ])}
      />
      <Container className="pt-5 lg:pt-0">
        <header className="text-center">
          <p className="font-display text-base font-semibold uppercase tracking-[0.14em] text-brand-light">
            Avaliação de troca
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-cream sm:text-4xl">
            Tem carro pra dar na troca?
          </h1>
          <div
            className="mx-auto mt-3 h-1 w-16 bg-brand"
            aria-hidden="true"
          />
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-cream/85 sm:text-lg">
            Responda rapidinho, um passo de cada vez, e mande pelo WhatsApp. Sem
            cadastro, sem foto e sem compromisso.
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start lg:gap-x-10 xl:gap-x-14">
          <section aria-label="Perguntas sobre o seu carro">
            <TradeForm
              key={interestVehicle?.id ?? "sem-carro"}
              interestVehicle={interestVehicle}
            />
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="border border-white/15 bg-ink p-4 sm:p-5">
              <h2 className="font-display text-lg font-bold text-cream">
                Como funciona
              </h2>
              <ol className="mt-3 grid gap-3">
                {STEPS.map(({ title, text }, index) => (
                  <li
                    key={title}
                    className="flex gap-3 border border-white/10 bg-asphalt p-3.5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-brand font-display text-base font-bold text-cream">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-semibold text-cream">
                        {title}
                      </h3>
                      <p className="mt-1 text-base leading-snug text-cream/80">
                        {text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="border border-white/15 bg-ink p-4 text-base text-cream/90 sm:p-5">
              <p className="flex items-center gap-2 font-display text-base font-semibold text-brand-light">
                <IconMapPin className="h-5 w-5 shrink-0" />
                Atendimento
              </p>
              <p className="mt-2 font-semibold text-cream">
                Atendemos Linhares, Aracruz e Grande Vitória
              </p>
              <p className="mt-1 text-cream/80">
                Combinamos o atendimento pelo WhatsApp.
              </p>
              <p className="mt-3 flex items-center gap-2 text-base text-cream/80">
                <IconClock className="h-5 w-5 shrink-0 text-brand-light" />
                <span>{publicSite.hours}</span>
              </p>
            </div>
          </aside>
        </div>
      </Container>
    </div>
  );
}
