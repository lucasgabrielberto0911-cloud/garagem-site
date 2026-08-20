/**
 * PREENCHER: pegar do Google Meu Negócio da loja.
 * Enquanto rating/reviewCount forem 0 ou a URL tiver PREENCHER,
 * o badge não aparece no site (não inventamos nota).
 */
export const GOOGLE_REVIEWS = {
  rating: 0, // ex.: 4.8
  reviewCount: 0, // ex.: 127
  profileUrl: "PREENCHER: URL do perfil Google Meu Negócio",
} as const;

export function googleReviewsReady() {
  return (
    GOOGLE_REVIEWS.rating > 0 &&
    GOOGLE_REVIEWS.reviewCount > 0 &&
    !GOOGLE_REVIEWS.profileUrl.includes("PREENCHER")
  );
}
