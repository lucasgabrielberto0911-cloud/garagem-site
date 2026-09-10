/**
 * Defaults do Google Meu Negócio.
 * O valor efetivo vem do Admin → Site (getGoogleReviews).
 * Badge some enquanto nota/contagem forem 0 ou a URL estiver vazia/PREENCHER.
 */
export type GoogleReviews = {
  rating: number;
  reviewCount: number;
  profileUrl: string;
};

export const DEFAULT_GOOGLE_REVIEWS: GoogleReviews = {
  rating: 0, // ex.: 4.8
  reviewCount: 0, // ex.: 127
  profileUrl: "",
};

/** @deprecated Use DEFAULT_GOOGLE_REVIEWS ou getGoogleReviews(). */
export const GOOGLE_REVIEWS = DEFAULT_GOOGLE_REVIEWS;

/** URL pública do Google (Maps / Meu Negócio) — vazia se não estiver configurada. */
export function publicGoogleUrl(reviews?: GoogleReviews | null) {
  const url = (reviews?.profileUrl ?? "").trim();
  if (!url || url.includes("PREENCHER") || url.includes("[")) return "";
  return /^https?:\/\//i.test(url) ? url : "";
}

export function googleReviewsReady(reviews: GoogleReviews = DEFAULT_GOOGLE_REVIEWS) {
  return (
    reviews.rating > 0 &&
    reviews.reviewCount > 0 &&
    Boolean(publicGoogleUrl(reviews))
  );
}
