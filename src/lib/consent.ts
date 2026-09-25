export const CONSENT_STORAGE_KEY = "garagem_consent";
export const CONSENT_EVENT = "garagem:consent";

export type ConsentChoice = "accepted" | "essential";

export function isConsentChoice(value: unknown): value is ConsentChoice {
  return value === "accepted" || value === "essential";
}

export function readStoredConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return isConsentChoice(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredConsent(choice: ConsentChoice) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    /* modo privado / storage cheio */
  }
  window.dispatchEvent(
    new CustomEvent<ConsentChoice>(CONSENT_EVENT, { detail: choice }),
  );
}

export function hasMarketingConsent(choice = readStoredConsent()) {
  return choice === "accepted";
}

/**
 * Pixel da Meta: aceite explícito, ou visita de anúncio (fbclid, ou
 * utm_source meta|facebook|fb|ig|instagram). O clique de anúncio carrega o
 * pixel mesmo com "só o essencial" — a atribuição do anúncio precisa do
 * script. Visita orgânica sem aceite não carrega. Google Analytics continua
 * só em hasMarketingConsent.
 */
export function shouldLoadMetaPixel(
  choice: ConsentChoice | null,
  search = "",
) {
  if (choice === "accepted") return true;
  const query = search.startsWith("?") ? search.slice(1) : search;
  return /(?:^|&)fbclid=/.test(query) ||
    /(?:^|&)utm_source=(?:meta|facebook|fb|ig|instagram)(?:&|$)/i.test(query);
}
