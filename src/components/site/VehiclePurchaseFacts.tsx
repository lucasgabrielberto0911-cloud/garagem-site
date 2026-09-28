import {
  publicPurchaseFacts,
} from "@/lib/vehicle-dossier";

/** Vistoria, garantia, pneus e equipamentos — só o que este anúncio tem. */
export function VehiclePurchaseFacts({
  inspection,
  warranty,
  accessories,
  className = "",
}: {
  inspection?: string | null;
  warranty?: string | null;
  accessories?: string[];
  className?: string;
}) {
  const facts = publicPurchaseFacts({ inspection, warranty, accessories });
  if (facts.length === 0) return null;

  return (
    <ul className={`space-y-2 ${className}`.trim()}>
      {facts.map((fact) => (
        <li key={fact.id} className="min-w-0">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {fact.label}
          </p>
          {fact.detail ? (
            <p className="mt-0.5 line-clamp-3 text-[13px] leading-snug text-cream">
              {fact.detail}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
