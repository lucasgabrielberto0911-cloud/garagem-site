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

export function googleReviewsReady(reviews: GoogleReviews = DEFAULT_GOOGLE_REVIEWS) {
  const url = reviews.profileUrl.trim();
  return (
    reviews.rating > 0 &&
    reviews.reviewCount > 0 &&
    url.length > 0 &&
    !url.includes("PREENCHER") &&
    /^https?:\/\//i.test(url)
  );
}
