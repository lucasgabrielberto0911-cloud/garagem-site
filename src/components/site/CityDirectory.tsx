import Link from "next/link";
import { SERVICE_CITIES } from "@/lib/service-cities";

/**
 * Mesma caixa para toda cidade: a grade iguala a largura, a altura mínima
 * é enxuta e o texto quebra em vez de ser cortado.
 */
const CITY_BUTTON_CLASS =
  "flex h-full min-h-16 w-full flex-col items-center justify-center gap-0.5 whitespace-normal break-normal border border-white/15 bg-ink px-4 py-3 text-center font-display text-sm font-semibold leading-snug text-cream text-balance transition hover:border-brand hover:bg-brand/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream sm:text-base";

export function CityDirectory() {
  return (
    <nav aria-label="Cidades atendidas">
      <ul className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
        {SERVICE_CITIES.map((city) => (
          <li key={city.slug} className="flex">
            <Link
              href={`/seminovos/${city.slug}`}
              className={CITY_BUTTON_CLASS}
              aria-label={`Seminovos em ${city.name}`}
            >
              <span>Seminovos em {city.name}</span>
              <span className="text-xs font-normal text-muted">
                Atendimento online pelo WhatsApp
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
