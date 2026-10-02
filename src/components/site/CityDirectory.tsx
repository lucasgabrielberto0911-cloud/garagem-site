import Link from "next/link";
import { SERVICE_CITIES } from "@/lib/service-cities";

/**
 * Mesma caixa para toda cidade: a grade iguala a largura, a altura mínima
 * cabe o nome mais longo e o texto quebra em vez de ser cortado.
 */
const CITY_BUTTON_CLASS =
  "flex h-full min-h-28 w-full items-center justify-center whitespace-normal break-normal border border-white/15 bg-ink px-5 py-4 text-center font-display text-sm font-semibold leading-snug text-cream text-balance transition hover:border-brand hover:bg-brand/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream sm:text-base";

export function CityDirectory() {
  return (
    <nav aria-label="Cidades atendidas">
      <ul className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
        {SERVICE_CITIES.map((city) => (
          <li key={city.slug} className="flex">
            <Link
              href={`/seminovos/${city.slug}`}
              className={CITY_BUTTON_CLASS}
            >
              Seminovos em {city.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
