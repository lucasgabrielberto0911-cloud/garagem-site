import type { ReactNode } from "react";
import Link from "next/link";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { ShareVehicle } from "@/components/site/ShareVehicle";
import { VehicleAccessoryChips } from "@/components/site/VehicleAccessoryChips";
import { VehicleDescription } from "@/components/site/VehicleDescription";
import { VehicleQuickActions } from "@/components/site/VehicleQuickActions";
import { VehicleInspectionBadge } from "@/components/site/VehicleInspectionBadge";
import { VehicleSeals } from "@/components/site/VehicleSeals";
import { VehicleTrustNotes } from "@/components/site/VehicleTrustNotes";
import type { DescriptionSummaryFacts } from "@/lib/vehicle-description";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import {
  SPEC_EMPTY,
  STORE_INSPECTION_LABEL,
  STORE_INSPECTION_NOTE,
  type VehicleSpecRow,
  formatVehicleYearRange,
  publicInspectionNote,
} from "@/lib/vehicle-specs";
import {
  publicStoreInspectionText,
  DEFAULT_VEHICLE_CONDITIONS,
  isPlaceholderCopy,
  publishedConditionItems,
  type VehicleConditionsContent,
} from "@/lib/vehicle-conditions";
import { whatsappContentFromVehicle } from "@/lib/site";
import { VehicleVerifiedList } from "@/components/site/VehicleVerifiedInfo";
import type { PublicVerifiedItem } from "@/lib/vehicle-verified";
import type { VehicleSeal } from "@/lib/vehicle-seals";

/** Já aparecem na primeira dobra. */
const FOLD_LABELS = new Set(["Ano", "km", "Câmbio"]);

/** A âncora Especificações cai na grade completa quando ela existe. */
export function hasMobileFichaSpecs(specs: VehicleSpecRow[]) {
  return specs.some((row) => !FOLD_LABELS.has(row.label));
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
  plateEnd,
  inspection,
  seals = [],
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
  plateEnd?: string | null;
  inspection?: string | null;
  /** Selos já filtrados (sem dado = sem selo). */
  seals?: readonly VehicleSeal[];
  /** Quando a grade completa não existe, a âncora aponta para estes fatos. */
  specAnchor?: boolean;
}) {
  const facts = [
    { label: "Ano", value: formatVehicleYearRange(year, yearModel) },
    { label: "Km", value: formatNumberBR(km) },
    { label: "Câmbio", value: transmission.trim() || SPEC_EMPTY },
  ];
  const plate = (plateEnd ?? "").replace(/\s+/g, " ").trim();

  return (
    <div className="ficha-mobile-sheet px-4 pb-3 pt-3 sm:px-6">
      <p className="break-normal whitespace-normal font-display text-[1.25rem] font-bold leading-snug tracking-tight text-cream">
        {title}
      </p>
      {version ? (
        <p className="mt-1 break-normal whitespace-normal text-sm leading-relaxed text-muted">{version}</p>
      ) : null}
      <p className="mt-1.5 font-display text-[1.65rem] font-bold leading-none tracking-tight text-brand-light">
        {sold ? (
          <span className="text-base text-muted">Já vendido</span>
        ) : (
          formatCurrencyBRL(price)
        )}
      </p>
      {!sold ? (
        <VehicleInspectionBadge inspection={inspection} className="mt-2.5" />
      ) : null}
      {!sold ? <VehicleSeals seals={seals} className="mt-2.5" /> : null}
      <dl
        className={`mt-2.5 grid grid-cols-2 gap-1.5${specAnchor ? " ficha-jump-target" : ""}`}
        id={specAnchor ? "especificacoes" : undefined}
        data-ficha-section={specAnchor ? "especificacoes" : undefined}
      >
        {facts.map((fact) => (
          <div key={fact.label} className={`min-w-0 border border-white/10 bg-ink px-2.5 py-2${fact.label === "Câmbio" ? " col-span-2" : ""}`}>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
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
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
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
      <summary className="flex min-h-[3rem] cursor-pointer list-none items-center justify-between gap-3 py-3.5 font-display text-[15px] font-semibold tracking-tight text-cream [&::-webkit-details-marker]:hidden">
        <h2 className="contents"><span>{title}</span></h2>
        <span
          aria-hidden="true"
          className="text-muted transition-transform duration-200 group-open:rotate-180 group-open:text-brand-light"
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
      <div className="pb-4 text-[15px] leading-relaxed text-cream/80">{children}</div>
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
  prompt,
  quickActions,
  verified = [],
  verifiedHeading,
  warranty,
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
  prompt: string;
  /** Pontos verificados daquele exemplar (só os preenchidos). Vazio = sem bloco. */
  verified?: PublicVerifiedItem[];
  verifiedHeading?: string;
  warranty?: string | null;
  quickActions?: {
    contentPath: string;
    video: string;
    finance: string;
    trade: string;
    visit?: string;
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
  const introText = conditions.intro.trim();
  // O texto padrão repete a garantia/itens abaixo; introdução personalizada fica.
  const intro =
    isPlaceholderCopy(introText) ||
    (otherConditions.length > 0 && introText === DEFAULT_VEHICLE_CONDITIONS.intro.trim())
      ? ""
      : introText;

  return (
    <div className="mt-5 border-t border-white/10 lg:hidden">
      {verified.length > 0 ? (
        <DossierBlock title={verifiedHeading ?? "Verificado neste carro"} defaultOpen>
          <VehicleVerifiedList items={verified} alt={fullLabel} showVideoHint={!sold} />
        </DossierBlock>
      ) : null}

      <DossierBlock title={STORE_INSPECTION_LABEL}>
        {inspectionNote && inspectionNote !== STORE_INSPECTION_NOTE ? (
          <p className="mb-2.5 text-[15px] leading-relaxed text-cream">{inspectionNote}</p>
        ) : null}
        <p className="text-[15px] leading-relaxed text-cream/90">
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
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  {spec.label}
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

      {intro || otherConditions.length > 0 ? (
        <DossierBlock title={conditions.title}>
          {intro ? <p>{intro}</p> : null}
          {otherConditions.length > 0 ? (
            <ul className={intro ? "mt-4 space-y-3" : "space-y-3"}>
              {otherConditions.map((item) => (
                <li key={item.label} className="border-l-2 border-brand/80 pl-3">
                  <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-cream">
                    {item.label}
                  </p>
                  <p className="mt-1 text-[15px] leading-relaxed text-cream/80">
                    {item.label.toLocaleLowerCase("pt-BR") === "garantia" && warranty
                      ? warranty
                      : item.text}
                  </p>
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
          <VehicleAccessoryChips items={accessories} />
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
              visit={quickActions.visit}
              className="grid"
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Cada opção abre o WhatsApp deste veículo.
          </p>
          <ChatOpenButton
            source="ficha"
            prompt={prompt}
            size="md"
            variant="outline"
            className="mt-3 w-full"
          />
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Dúvida breve no site. Preço, visita e proposta seguem no WhatsApp.
          </p>
        </DossierBlock>
      ) : null}

      <DossierBlock title="Atendimento">
        {!sold ? (
          <VehicleTrustNotes
            className="mb-3"
            warranty={warranty}
            documentation={verified.find((item) => item.key === "documentacao")?.text}
          />
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
        <p className="text-xs leading-relaxed">
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
