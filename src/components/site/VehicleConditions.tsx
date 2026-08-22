import { IconClipboardCheck, IconFileText, IconShieldCheck } from "@/components/site/icons";
import {
  isPlaceholderCopy,
  publishedConditionItems,
  type VehicleConditionsContent,
} from "@/lib/vehicle-conditions";

const ICONS = [IconShieldCheck, IconFileText, IconClipboardCheck];

export function VehicleConditions({
  vehicleWarranty,
  conditions,
}: {
  vehicleWarranty?: string | null;
  conditions: VehicleConditionsContent;
}) {
  const warranty = vehicleWarranty?.trim() || null;
  const intro = isPlaceholderCopy(conditions.intro) ? null : conditions.intro;
  const readyItems = publishedConditionItems(conditions.items);

  return (
    <div className="border border-white/10 bg-asphalt/50 p-4 sm:p-5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
        {conditions.title}
      </h2>
      {warranty ? (
        <p className="mt-2 text-sm text-cream/90">
          Neste veículo: <span className="font-medium">{warranty}</span>
        </p>
      ) : null}
      {intro ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">{intro}</p>
      ) : null}
      {readyItems.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {readyItems.map((item, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <li key={`${item.label}-${index}`} className="flex gap-2.5 text-sm">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>
                  <span className="font-display font-semibold text-cream">
                    {item.label}.{" "}
                  </span>
                  <span className="text-muted">{item.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Confirme garantia, documentação e transferência no WhatsApp antes de
          fechar.
        </p>
      )}
    </div>
  );
}
