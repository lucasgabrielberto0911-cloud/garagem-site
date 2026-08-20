import { IconStar } from "@/components/site/icons";
import {
  GOOGLE_REVIEWS,
  googleReviewsReady,
} from "@/lib/google-reviews";

export function GoogleReviewsBadge() {
  if (!googleReviewsReady()) return null;

  const rating = GOOGLE_REVIEWS.rating.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const count = GOOGLE_REVIEWS.reviewCount.toLocaleString("pt-BR");

  return (
    <a
      href={GOOGLE_REVIEWS.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mx-auto mt-5 inline-flex min-h-[44px] items-center gap-2 border border-white/10 bg-ink px-4 py-2 text-sm text-cream transition hover:border-brand"
    >
      <IconStar className="h-4 w-4 text-brand" />
      <span className="font-display font-semibold">{rating}</span>
      <span className="text-muted">
        ({count} {GOOGLE_REVIEWS.reviewCount === 1 ? "avaliação" : "avaliações"} no
        Google)
      </span>
    </a>
  );
}
