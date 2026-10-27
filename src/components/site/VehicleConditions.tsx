import { IconClipboardCheck, IconFileText, IconShieldCheck } from "@/components/site/icons";
import {
  isPlaceholderCopy,
  publicStoreInspectionText,
  publishedConditionItems,
  type ConditionItem,
  type VehicleConditionsContent,
} from "@/lib/vehicle-conditions";

const ICONS = [IconShieldCheck, IconFileText, IconClipboardCheck];

function isLabel(item: ConditionItem, label: string) {
  return item.label.toLocaleLowerCase("pt-BR") === label;
}

function conditionText(item: ConditionItem, warranty: string | null) {
  if (isLabel(item, "vistoria da loja")) return publicStoreInspectionText(item.text);
  if (isLabel(item, "garantia") && warranty) return warranty;
  return item.text;
}

/**
 * Garantia compacta da coluna esquerda (desktop). Usa os mesmos dados do painel
 * que o bloco mobile (`VehicleMobileDossier`): título, itens editados e itens ocultados.
 */
export function VehicleConditions({
  vehicleWarranty,
  conditions,
}: {
  vehicleWarranty?: string | null;
  conditions: VehicleConditionsContent;
}) {
  const warranty = vehicleWarranty?.trim() || null;
  const items = publishedConditionItems(conditions.items);
  const intro = isPlaceholderCopy(conditions.intro) ? "" : conditions.intro.trim();
  if (items.length === 0 && !intro) return null;

  return (
    <section
      aria-label={conditions.title}
      className="hidden border-t border-white/10 pt-5 lg:mt-6 lg:block"
    >
      <h2 className="font-display text-base font-semibold text-cream">
        {conditions.title}
      </h2>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <li
                key={`${item.label}-${index}`}
                className="flex items-start gap-2.5 text-sm leading-snug"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
                <span className="line-clamp-2">
                  <span className="font-display font-semibold text-cream">{item.label}</span>
                  <span className="text-muted">
                    {" · "}
                    {conditionText(item, warranty)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 line-clamp-3 text-sm leading-snug text-muted">{intro}</p>
      )}
    </section>
  );
}
