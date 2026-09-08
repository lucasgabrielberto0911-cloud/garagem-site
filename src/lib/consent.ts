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
