import { IconStar } from "@/components/site/icons";
import { googleReviewsReady, type GoogleReviews } from "@/lib/google-reviews";

export function GoogleReviewsBadge({ reviews }: { reviews: GoogleReviews }) {
  if (!googleReviewsReady(reviews)) return null;

  const rating = reviews.rating.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const count = reviews.reviewCount.toLocaleString("pt-BR");

  return (
    <a
      href={reviews.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mx-auto mt-5 inline-flex min-h-[44px] items-center gap-2 border border-white/10 bg-ink px-4 py-2 text-sm text-cream transition hover:border-brand"
    >
      <IconStar className="h-4 w-4 text-brand" />
      <span className="font-display font-semibold">{rating}</span>
      <span className="text-muted">
        ({count} {reviews.reviewCount === 1 ? "avaliação" : "avaliações"} no
        Google)
      </span>
    </a>
  );
}
