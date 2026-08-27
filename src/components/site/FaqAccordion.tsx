import { ScrollReveal } from "@/components/site/ScrollReveal";
import { faqItemId, type FaqItem } from "@/lib/faq";

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-white/10 border border-white/10 bg-ink">
      {items.map((item, index) => {
        const id = faqItemId(item.question, index);
        return (
          <ScrollReveal key={item.question} delay={Math.min(index * 30, 120)}>
            <details id={id} className="group scroll-mt-28 px-5 py-4 sm:px-6">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-4 py-1 font-display text-base font-semibold text-cream marker:hidden touch-manipulation">
                <span>{item.question}</span>
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
