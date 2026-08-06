import { ScrollReveal } from "@/components/site/ScrollReveal";
import type { FaqItem } from "@/lib/faq";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-white/10 border border-white/10 bg-ink">
      {items.map((item, index) => {
        const id = `faq-${slugify(item.question) || index}`;
        return (
          <ScrollReveal key={item.question} delay={Math.min(index * 30, 120)}>
            <details id={id} className="group scroll-mt-28 px-5 py-4 sm:px-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-display text-base font-semibold text-cream marker:hidden">
                {item.question}
                <span
                  className="mt-1 shrink-0 text-brand transition-transform duration-300 group-open:rotate-45"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="h-4 w-4"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {item.answer}
              </p>
            </details>
          </ScrollReveal>
        );
      })}
    </div>
  );
}
