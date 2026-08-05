import Image from "next/image";
import { WhatsAppButton } from "@/components/site/ui";
import { IconQuote } from "@/components/site/icons";
import { WHATSAPP_MESSAGES } from "@/lib/site";

export type TestimonialItem = {
  id: string;
  name: string;
  city: string | null;
  message: string;
  photoUrl: string | null;
};

/**
 * Os depoimentos vêm da tabela `Testimonial`. Enquanto ela estiver vazia o
 * bloco mostra um estado vazio — nenhum depoimento fictício é exibido.
 */
export function Testimonials({ items }: { items: TestimonialItem[] }) {
  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center border border-dashed border-white/15 bg-ink/40 px-6 py-14 text-center">
        <IconQuote className="h-9 w-9 text-white/15" />
        <p className="mt-5 font-display text-lg font-semibold text-cream">
          Em breve, depoimentos de clientes reais
        </p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
          Estamos reunindo as experiências de quem já comprou com a gente. Só
          publicamos avaliações verdadeiras, com nome e cidade.
        </p>
        <WhatsAppButton
          className="mt-7"
          message={WHATSAPP_MESSAGES.general}
          size="md"
        >
          Falar com a Garagem
        </WhatsAppButton>
      </div>
    );
  }

  const width =
    items.length === 1 ? "max-w-md" : items.length === 2 ? "max-w-3xl" : "";

  return (
    <ul className={`mx-auto grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${width}`}>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col items-center border border-white/10 bg-ink p-6 text-center"
        >
          <IconQuote className="h-6 w-6 text-brand/60" />
          <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-cream/90">
            {item.message}
          </blockquote>
          <div className="mt-6 flex w-full items-center justify-center gap-3 border-t border-white/10 pt-5">
            <Avatar name={item.name} photoUrl={item.photoUrl} />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold text-cream">
                {item.name}
              </p>
              {item.city ? (
                <p className="truncate text-xs text-muted">{item.city}</p>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Avatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl: string | null;
}) {
  if (photoUrl) {
    return (
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-asphalt">
        <Image
          src={photoUrl}
          alt={name}
          fill
          sizes="40px"
          unoptimized
          className="object-cover"
        />
      </div>
    );
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 font-display text-sm font-semibold text-brand"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
