import { IconClipboardCheck, IconFileText, IconShieldCheck } from "@/components/site/icons";
import { type VehicleConditionsContent } from "@/lib/vehicle-conditions";

/** Uma linha por item: o detalhe longo fica no WhatsApp e no bloco mobile. */
const ITEMS = [
  { Icon: IconShieldCheck, label: "Garantia", detail: "Motor e câmbio por 3 meses" },
  {
    Icon: IconFileText,
    label: "Documentação e transferência",
    detail: "combinadas pelo WhatsApp",
  },
  {
    Icon: IconClipboardCheck,
    label: "Vistoria da loja",
    detail: "cada carro é conferido antes de anunciar",
  },
];

export function VehicleConditions({
  vehicleWarranty,
  conditions,
}: {
  vehicleWarranty?: string | null;
  conditions: VehicleConditionsContent;
}) {
  const warranty = vehicleWarranty?.trim() || null;

  return (
    <section
      aria-label={conditions.title}
      className="hidden border-t border-white/10 pt-5 lg:mt-6 lg:block"
    >
      <h2 className="font-display text-base font-semibold text-cream">
        {conditions.title}
      </h2>
      <ul className="mt-3 space-y-2">
        {ITEMS.map(({ Icon, label, detail }, index) => (
          <li key={label} className="flex items-start gap-2.5 text-sm leading-snug">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
            <span>
              <span className="font-display font-semibold text-cream">{label}</span>
              <span className="text-muted">
                {" · "}
                {index === 0 && warranty ? warranty : detail}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
