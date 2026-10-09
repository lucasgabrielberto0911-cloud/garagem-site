import type { ReactNode } from "react";
import Link from "next/link";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { GoogleReviewsBadge } from "@/components/site/GoogleReviewsBadge";
import { ShareVehicle } from "@/components/site/ShareVehicle";
import { VehicleDescription } from "@/components/site/VehicleDescription";
import { VehicleQuickActions } from "@/components/site/VehicleQuickActions";
import { VehicleInspectionBadge } from "@/components/site/VehicleInspectionBadge";
import { VehicleTrustNotes } from "@/components/site/VehicleTrustNotes";
import type { DescriptionSummaryFacts } from "@/lib/vehicle-description";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import type { GoogleReviews } from "@/lib/google-reviews";
import {
  SPEC_EMPTY,
  SPEC_EMPTY_FEMININE,
  STORE_INSPECTION_LABEL,
  STORE_INSPECTION_NOTE,
  type VehicleSpecRow,
  formatVehicleYearRange,
  publicInspectionNote,
} from "@/lib/vehicle-specs";
import {
  publicStoreInspectionText,
  publishedConditionItems,
  type VehicleConditionsContent,
} from "@/lib/vehicle-conditions";
import { whatsappContentFromVehicle } from "@/lib/site";

/** Já aparecem na primeira dobra. Cidade volta na grade da Ficha, ao lado de Portas. */
const FOLD_LABELS = new Set(["Ano", "KM", "Câmbio"]);

/** A âncora Especificações cai na grade completa quando ela existe. */
export function hasMobileFichaSpecs(specs: VehicleSpecRow[]) {
  return specs.some((row) => !FOLD_LABELS.has(row.label));
}

function fichaGridLabel(label: string) {
  return label === "Disponível em" ? "Cidade" : label;
}

export function VehicleMobileSummary({
  title,
  version,
  price,
  sold,
  year,
  yearModel,
  km,
  transmission,
  city,
  plateEnd,
  inspection,
  specAnchor = false,
}: {
  title: string;
  version?: string | null;
  price: number;
  sold: boolean;
  year: number;
  yearModel: number;
  km: number;
  transmission: string;
  city: string;
  plateEnd?: string | null;
  inspection?: string | null;
  /** Quando a grade completa não existe, a âncora aponta para estes fatos. */
  specAnchor?: boolean;
}) {
  const facts = [
    { label: "Ano", value: formatVehicleYearRange(year, yearModel) },
    { label: "Km", value: formatNumberBR(km) },
    { label: "Câmbio", value: transmission.trim() || SPEC_EMPTY },
    { label: "Cidade", value: city.trim() || SPEC_EMPTY_FEMININE },
  ];
  const plate = (plateEnd ?? "").replace(/\s+/g, " ").trim();

  return (
    <div className="ficha-mobile-sheet px-4 pb-3 pt-3 sm:px-6">
      <h1 className="break-normal whitespace-normal font-display text-[1.25rem] font-bold leading-snug tracking-tight text-cream">
        {title}
      </h1>
      {version ? (
        <p className="mt-1 break-normal whitespace-normal text-sm leading-relaxed text-muted">{version}</p>
      ) : null}
      <p className="mt-1.5 font-display text-[1.65rem] font-bold leading-none tracking-tight text-brand">
        {sold ? (
          <span className="text-base text-muted">Já vendido</span>
        ) : (
          formatCurrencyBRL(price)
        )}
      </p>
      {!sold ? (
        <VehicleInspectionBadge inspection={inspection} className="mt-2.5" />
      ) : null}
      <dl
        className={`mt-2.5 grid grid-cols-2 gap-1.5${specAnchor ? " ficha-jump-target" : ""}`}
        id={specAnchor ? "especificacoes" : undefined}
        data-ficha-section={specAnchor ? "especificacoes" : undefined}
      >
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0 border border-white/10 bg-ink px-2.5 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              {fact.label}
            </dt>
            <dd className="mt-0.5 font-display text-[13px] font-semibold leading-tight text-cream">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
      {plate ? (
        <p className="mt-2 text-[13px] leading-snug text-cream">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Final da placa{" "}
          </span>
          <span className="font-display font-semibold">{plate}</span>
        </p>
      ) : null}
    </div>
  );
}

function DossierBlock({
  title,
  children,
  defaultOpen = false,
  section,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  section?: "especificacoes" | "detalhes";
}) {
  return (
    <details
      className={`group border-b border-white/10${section ? " ficha-jump-target" : ""}`}
      open={defaultOpen}
      id={section}
      data-ficha-section={section}
    >
      <summary className="flex min-h-[3.25rem] cursor-pointer list-none items-center justify-between gap-3 py-4 font-display text-[15px] font-semibold tracking-tight text-cream [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span
          aria-hidden="true"
          className="text-muted transition-transform duration-200 group-open:rotate-180 group-open:text-brand"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3.5 6L8 10.5L12.5 6"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </span>
      </summary>
      <div className="pb-5 text-[15px] leading-relaxed text-cream/80">{children}</div>
    </details>
  );
}

export function VehicleMobileBlocks({
  fullLabel,
  path,
  sold,
  price,
  yearModel,
  make,
  model,
  vehicleId,
  description,
  summaryFacts,
  accessories,
  specs,
  inspection,
  conditions,
  listedLine,
  google,
  prompt,
  quickActions,
}: {
  fullLabel: string;
  path: string;
  sold: boolean;
  price: number;
  yearModel: number;
  make: string;
  model: string;
  vehicleId: string;
  description?: string | null;
  summaryFacts?: DescriptionSummaryFacts;
  accessories: string[];
  specs: VehicleSpecRow[];
  inspection?: string | null;
  conditions: VehicleConditionsContent;
  listedLine?: ReactNode;
  google: GoogleReviews;
  prompt: string;
  quickActions?: {
    contentPath: string;
    video: string;
    finance: string;
    trade: string;
    stateOfVehicle?: string;
    exteriorColor?: string;
    transmission?: string;
    bodyStyle?: string;
    fuelType?: string;
    postalCode?: string;
  };
}) {
  const extraSpecs = specs.filter((row) => !FOLD_LABELS.has(row.label));
  const inspectionNote = publicInspectionNote(inspection);
  const conditionItems = publishedConditionItems(conditions.items);
  const vistoria = conditionItems.find(
    (item) => item.label.toLocaleLowerCase("pt-BR") === "vistoria da loja",
  );
  const otherConditions = conditionItems.filter((item) => item !== vistoria);

  return (
    <div className="mt-5 border-t border-white/10 lg:hidden">
      <DossierBlock title={STORE_INSPECTION_LABEL}>
        {inspectionNote && inspectionNote !== STORE_INSPECTION_NOTE ? (
          <p className="mb-3 text-[15px] leading-7 text-cream">{inspectionNote}</p>
        ) : null}
        <p className="text-[15px] leading-7 text-cream/90">
          {publicStoreInspectionText(vistoria?.text)}
        </p>
      </DossierBlock>

      {extraSpecs.length > 0 ? (
        <DossierBlock title="Ficha" section="especificacoes">
          {listedLine ? (
            <p className="mb-3 text-xs tracking-wide text-muted">{listedLine}</p>
          ) : null}
          <dl className="ficha-spec-grid grid grid-cols-2 gap-2">
            {extraSpecs.map((spec) => (
              <div key={spec.label} className="min-w-0 border border-white/10 bg-ink px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {fichaGridLabel(spec.label)}
                </dt>
                <dd
                  className={`mt-1 font-display text-sm leading-snug [overflow-wrap:anywhere] ${
                    spec.empty ? "font-medium text-muted" : "font-semibold text-cream"
                  }`}
                >
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>
        </DossierBlock>
      ) : null}

      {conditions.intro || otherConditions.length > 0 ? (
        <DossierBlock title="Garantia de 3 meses: motor e câmbio">
          {conditions.intro ? <p>{conditions.intro}</p> : null}
          {otherConditions.length > 0 ? (
            <ul className={conditions.intro ? "mt-4 space-y-3" : "space-y-3"}>
              {otherConditions.map((item) => (
                <li key={item.label} className="border-l-2 border-brand/80 pl-3">
                  <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-cream">
                    {item.label}
                  </p>
                  <p className="mt-1 text-[15px] leading-relaxed text-cream/80">{item.text}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </DossierBlock>
      ) : null}

      {description ? (
        <DossierBlock title="Sobre o veículo" defaultOpen section="detalhes">
          <VehicleDescription text={description} summaryFacts={summaryFacts} />
        </DossierBlock>
      ) : null}

      {accessories.length > 0 ? (
        <DossierBlock
          title="Itens e acessórios"
          defaultOpen
          section={description ? undefined : "detalhes"}
        >
          <ul className="divide-y divide-white/10 border border-white/10">
            {accessories.map((item) => (
              <li key={item} className="flex items-center gap-3 px-3 py-2.5 text-cream">
                <span className="h-1.5 w-1.5 shrink-0 bg-brand" aria-hidden="true" />
                <span className="text-[15px] leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </DossierBlock>
      ) : null}

      {!sold && quickActions ? (
        <DossierBlock title="Vídeo e propostas">
          <p>
            Peça um vídeo no WhatsApp. A gravação mostra os pontos que você
            quiser ver — a página não guarda arquivo de vídeo.
          </p>
          <div className="mt-3">
            <VehicleQuickActions
              contentId={vehicleId}
              contentSlug={whatsappContentFromVehicle({ id: vehicleId, path })}
              contentPath={quickActions.contentPath}
              contentName={fullLabel}
              value={price}
              make={make}
              model={model}
              year={yearModel}
              stateOfVehicle={quickActions.stateOfVehicle}
              exteriorColor={quickActions.exteriorColor}
              transmission={quickActions.transmission}
              bodyStyle={quickActions.bodyStyle}
              fuelType={quickActions.fuelType}
              postalCode={quickActions.postalCode}
              video={quickActions.video}
              finance={quickActions.finance}
              trade={quickActions.trade}
              className="grid"
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Cada opção abre o WhatsApp deste veículo.
          </p>
          <ChatOpenButton
            source="ficha"
            prompt={prompt}
            size="md"
            variant="outline"
            className="mt-3 w-full"
          />
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Dúvida breve no site. Preço, visita e proposta seguem no WhatsApp.
          </p>
        </DossierBlock>
      ) : null}

      <DossierBlock title="Atendimento">
        {!sold ? <VehicleTrustNotes className="mb-3" /> : null}
        {!sold ? (
          <GoogleReviewsBadge reviews={google} className="mb-3 border-white/10" />
        ) : null}
        {!sold ? (
          <FavoriteButton
            vehicleId={vehicleId}
            label={fullLabel}
            value={price}
            make={make}
            model={model}
            year={yearModel}
            variant="full"
            className="mb-3 w-full"
          />
        ) : null}
        <p className="text-[11px] leading-relaxed">
          Financiamento em até 60x e cartão em até 18x. O consultor calcula a
          parcela no WhatsApp — o site não publica valor de parcela. Sujeito a
          análise de crédito e CET.
        </p>
        {!sold ? (
          <Link
            href={`/vender?interesse=${vehicleId}&label=${encodeURIComponent(fullLabel)}`}
            prefetch={false}
            className="mt-3 inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-cream hover:underline"
          >
            Ou preencha a avaliação do seu usado
          </Link>
        ) : null}
        <ShareVehicle
          title={fullLabel}
          path={path}
          vehicleId={vehicleId}
          className="mt-3 border-t border-white/10 pt-3"
        />
      </DossierBlock>
    </div>
  );
}
