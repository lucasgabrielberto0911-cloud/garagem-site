import Image from "next/image";

export function FounderSection({
  photoUrl,
}: {
  photoUrl?: string | null;
}) {
  const portrait = photoUrl?.trim() || null;

  return (
    <section
      id="por-tras"
      aria-labelledby="titulo-por-tras"
      className="mx-auto mt-10 max-w-5xl scroll-mt-28 overflow-hidden border border-white/10 bg-black sm:mt-12"
    >
      <div
        className={
          portrait
            ? "grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
            : ""
        }
      >
        {portrait ? (
          <div className="relative min-h-[420px] bg-black sm:min-h-[520px] lg:order-2 lg:min-h-full">
            <Image
              src={portrait}
              alt="Elias Clovis Gonçalves dos Santos Neto, dono e sócio-administrador da Garagem"
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
              quality={90}
              className="object-contain object-bottom"
            />
          </div>
        ) : null}

        <div
          className={
            portrait
              ? "flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12 lg:order-1 lg:px-12 lg:py-14"
              : "mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14"
          }
        >
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
            Quem está por trás da Garagem?
          </p>
          <h2
            id="titulo-por-tras"
            className="mt-3 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl"
          >
            Elias Clovis Gonçalves dos Santos Neto
          </h2>
          <p className="mt-2 text-sm font-medium text-cream/80">
            Dono e sócio-administrador
          </p>
          <div
            className="mt-5 h-0.5 w-12 bg-brand-gradient"
            aria-hidden="true"
          />

          <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted sm:text-[15px]">
            <p>
              Natural de Feira de Santana, na Bahia, Elias construiu a vida no
              mercado de veículos. Há mais de 20 anos ele compra, avalia e vende
              carros — um ofício que trata como conversa de confiança, não como
              pressão de balcão.
            </p>
            <p>
              Foi essa estrada que o trouxe à frente da Garagem: uma loja digital
              no Espírito Santo, com atendimento em Aracruz, Vitória, Linhares e
              região, feita para quem busca seminovo com procedência e alguém do
              outro lado do WhatsApp que realmente resolve.
            </p>
            <p>
              O foco dele é simples e difícil de fingir: entregar a melhor
              experiência para cada cliente. Do primeiro “olá” ao vídeo do carro,
              da troca à transferência, o padrão é o mesmo — clareza no preço,
              seriedade na procedência e cuidado com o que pesa no bolso e na
              decisão.
            </p>
            <p>
              Por isso a Garagem não é só estoque na tela. É o jeito de Elias de
              trabalhar: perto de quem compra, disponível todos os dias e
              comprometido com o resultado de cada negócio — um cliente de cada
              vez.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
