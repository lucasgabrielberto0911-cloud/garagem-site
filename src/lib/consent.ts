export const CONSENT_STORAGE_KEY = "garagem_consent";
export const CONSENT_EVENT = "garagem:consent";

/** Executa no head, antes da primeira pintura e sem depender da hidratação. */
export function consentBootstrapScript() {
  return `(()=>{try{const c=localStorage.getItem("${CONSENT_STORAGE_KEY}");if(c==="accepted"||c==="essential")document.documentElement.dataset.consent=c}catch{}})()`;
}

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
  if (typeof document !== "undefined") document.documentElement.dataset.consent = choice;
  window.dispatchEvent(
    new CustomEvent<ConsentChoice>(CONSENT_EVENT, { detail: choice }),
  );
}

export function hasMarketingConsent(choice = readStoredConsent()) {
  return choice === "accepted";
}

const AD_VISIT_STORAGE_KEY = "garagem_ad_visit";

/** Clique de anúncio da Meta: fbclid ou utm_source meta|facebook|fb|ig|instagram. */
export function isAdVisitSearch(search = "") {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return (
    /(?:^|&)fbclid=/.test(query) ||
    /(?:^|&)utm_source=(?:meta|facebook|fb|ig|instagram)(?:&|$)/i.test(query)
  );
}

/**
 * O fbclid/UTM só existe na URL de entrada: um 308 de slug, a troca de grupo de
 * rotas (estoque → ficha remonta o layout) ou um reload o perdem. Guarda a
 * visita de anúncio na aba (sessionStorage, some ao fechar) para o Pixel seguir
 * ligado até o clique no WhatsApp.
 */
export function rememberAdVisit(search = "") {
  if (typeof window === "undefined") return false;
  try {
    if (isAdVisitSearch(search)) {
      window.sessionStorage.setItem(AD_VISIT_STORAGE_KEY, "1");
      return true;
    }
    return window.sessionStorage.getItem(AD_VISIT_STORAGE_KEY) === "1";
  } catch {
    return isAdVisitSearch(search);
  }
}

/**
 * Pixel da Meta: aceite explícito, ou visita de anúncio (fbclid, ou
 * utm_source meta|facebook|fb|ig|instagram), lembrada na aba. O clique de
 * anúncio carrega o pixel mesmo com "só o essencial" — a atribuição do
 * anúncio precisa do script. Visita orgânica sem aceite não carrega. Google
 * Analytics continua só em hasMarketingConsent.
 */
export function shouldLoadMetaPixel(
  choice: ConsentChoice | null,
  search = "",
  adVisit = false,
) {
  if (choice === "accepted") return true;
  return adVisit || isAdVisitSearch(search);
}
