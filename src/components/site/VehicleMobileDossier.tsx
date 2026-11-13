import type { ReactNode } from "react";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { ShareVehicle } from "@/components/site/ShareVehicle";
import { VehicleFeatures } from "@/components/site/VehicleFeatures";
import { VehicleInspectionBadge } from "@/components/site/VehicleInspectionBadge";
import { VehicleDescription, visibleDescriptionSegments } from "@/components/site/VehicleDescription";
import { VehicleQuickActions } from "@/components/site/VehicleQuickActions";
import { VehicleSeals } from "@/components/site/VehicleSeals";
import { VehicleTrustNotes } from "@/components/site/VehicleTrustNotes";
import { IconMapPin } from "@/components/site/icons";
import type { DescriptionSummaryFacts } from "@/lib/vehicle-description";
import { formatCurrencyBRL } from "@/lib/format";
import {
  STORE_INSPECTION_LABEL,
  STORE_INSPECTION_NOTE,
  type VehicleKeyFact,
  type VehicleSpecRow,
  publicInspectionNote,
} from "@/lib/vehicle-specs";
import { VehicleKeyFacts } from "@/components/site/VehicleKeyFacts";
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

/** Garantia e vistoria já aparecem na faixa de confiança. */
const TRUST_LABELS = new Set(["Garantia", STORE_INSPECTION_LABEL]);

/** Já estão no topo da ficha (quadradinhos, cor ao lado do preço) ou não dizem nada ("Tipo: Carro"). */
const TOP_LABELS = new Set(["Tipo", "Ano", "km", "Câmbio", "Combustível", "Cor"]);

/**
 * Ficha técnica do celular: só o que ainda não apareceu acima (motor, portas, final de placa...).
 * Sem repetir o topo e sem linha "Não informada".
 */
function sheetSpecs(specs: VehicleSpecRow[]) {
  const motorAtTop = !specs.some((row) => row.label === "Câmbio" && !row.empty);
  return specs.filter(
    (row) =>
      !TRUST_LABELS.has(row.label) &&
      !TOP_LABELS.has(row.label) &&
      !(row.label === "Motor" && motorAtTop) &&
      !row.empty,
  );
}

/** A âncora Especificações cai na ficha técnica quando ela existe. */
export function hasMobileFichaSpecs(specs: VehicleSpecRow[]) {
  return sheetSpecs(specs).length > 0;
}

/**
 * O ano já está ao lado do título: sai dos quadradinhos. Se sobram 3 e há cor, a cor entra na grade
 * (2×2) em vez de ficar numa linha larga sozinha.
 */
function topFacts(
  facts: readonly VehicleKeyFact[],
  color: string | null | undefined,
  yearLabel: string | undefined,
) {
  const shown = yearLabel ? facts.filter((fact) => fact.label !== "Ano") : [...facts];
  if (color && shown.length === 3) return { facts: [...shown, { label: "Cor", value: color }], color: null };
  return { facts: shown, color };
}

export function VehicleMobileSummary({
  title,
  version,
  yearLabel,
  price,
  sold,
  facts,
  color,
  inspection,
  warranty,
  seals = [],
  specAnchor = false,
}: {
  title: string;
  version?: string | null;
  yearLabel?: string;
  price: number;
  sold: boolean;
  /** Ano, KM, câmbio e combustível (`vehicleKeyFacts`). O resto fica em "Ficha técnica". */
  facts: readonly VehicleKeyFact[];
  color?: string | null;
  inspection?: string | null;
  warranty?: string | null;
  /** Selos já filtrados (sem dado = sem selo). */
  seals?: readonly VehicleSeal[];
  /** Quando a ficha técnica não existe, a âncora aponta para estes fatos. */
  specAnchor?: boolean;
}) {
  return (
    <div className="ficha-mobile-sheet px-4 pb-3 pt-3 sm:px-6">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h1 className="break-normal whitespace-normal font-display text-[1.25rem] font-bold leading-snug tracking-tight text-cream">
          {title}
        </h1>
        {yearLabel ? (
          <span className="inline-flex shrink-0 items-center border border-white/20 bg-ink px-2 py-0.5 font-display text-sm font-semibold tabular-nums text-cream whitespace-nowrap">
            {yearLabel}
          </span>
        ) : null}
      </div>
      {version ? (
        <p className="mt-1 break-normal whitespace-normal text-sm leading-relaxed text-muted">{version}</p>
      ) : null}
      <p className="mt-1.5 font-display text-[1.75rem] font-bold leading-none tracking-tight text-brand-light">
        {sold ? (
          <span className="text-base text-muted">Já vendido</span>
        ) : (
          <span className="ficha-price">{formatCurrencyBRL(price)}</span>
        )}
      </p>
      {/* Logo abaixo do preço: é o que ainda cabe na primeira tela em celular baixo. */}
      {!sold ? <VehicleTrustNotes warranty={warranty} compact className="mt-2.5" /> : null}
      <div
        className={`mt-2.5${specAnchor ? " ficha-jump-target" : ""}`}
        id={specAnchor ? "especificacoes" : undefined}
        data-ficha-section={specAnchor ? "especificacoes" : undefined}
      >
        <VehicleKeyFacts {...topFacts(facts, color, yearLabel)} />
      </div>
      {!sold ? (
        <VehicleInspectionBadge inspection={inspection} className="mt-2.5" />
      ) : null}
      {!sold ? <VehicleSeals seals={seals.filter((seal) => seal.id !== "opcionais")} className="mt-2.5" /> : null}
    </div>
  );
}

/** Bloco sempre aberto: título em Sora, sem acordeão. */
function DossierBlock({
  title,
  children,
  section,
  id,
}: {
  title: string;
  children: ReactNode;
  section?: "especificacoes" | "detalhes";
  id?: string;
}) {
  return (
    <section
      className={`border-b border-white/10 py-5${section ? " ficha-jump-target" : ""}`}
      id={id ?? section}
      data-ficha-section={section}
    >
      <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-cream">{title}</h2>
      <div className="text-[15px] leading-relaxed text-cream/80">{children}</div>
    </section>
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
  quickActions,
  verified = [],
  verifiedHeading,
  warranty,
  hours,
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
  /** Pontos verificados daquele exemplar (só os preenchidos). Vazio = sem bloco. */
  verified?: PublicVerifiedItem[];
  verifiedHeading?: string;
  warranty?: string | null;
  /** Horário do painel (getPublicSite), igual ao rodapé. Não há endereço de loja. */
  hours: string;
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
  const extraSpecs = sheetSpecs(specs);
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
  const hasAbout =
    !!description &&
    visibleDescriptionSegments(description, summaryFacts, specs).length > 0;

  return (
    <div className="mt-2 pb-6 lg:hidden">
      {extraSpecs.length === 0 && listedLine ? (
        // Sem ficha técnica, o "Anunciado hoje · Atualizado em..." continua como linha solta.
        <p className="border-b border-white/10 pb-4 text-sm tracking-wide text-muted">{listedLine}</p>
      ) : null}
      {extraSpecs.length > 0 ? (
        <DossierBlock title="Ficha técnica" section="especificacoes">
          {listedLine ? (
            <p className="mb-3 text-sm tracking-wide text-muted">{listedLine}</p>
          ) : null}
          <dl className="ficha-spec-grid grid grid-cols-2 gap-2">
            {extraSpecs.map((spec) => (
              <div key={spec.label} className="min-w-0 border border-white/20 bg-ink px-3 py-2.5">
                <dt className="text-sm font-medium text-cream/75">{spec.label}</dt>
                <dd
                  className={`mt-1 font-display text-sm leading-snug [overflow-wrap:break-word] ${
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

      {!sold && quickActions ? (
        <DossierBlock title="Próximos passos" id="proximos-passos">
          <div>
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
              variant="secondary"
              className="grid"
            />
          </div>
        </DossierBlock>
      ) : null}

      {verified.length > 0 ? (
        <DossierBlock title={verifiedHeading ?? "Verificado neste carro"}>
          <VehicleVerifiedList items={verified} alt={fullLabel} showVideoHint={!sold} />
        </DossierBlock>
      ) : null}

      {hasAbout ? (
        <DossierBlock title="Sobre o veículo" section="detalhes">
          <VehicleDescription text={description!} summaryFacts={summaryFacts} specRows={specs} hideEmoji />
        </DossierBlock>
      ) : null}

      {accessories.length > 0 ? (
        <DossierBlock
          title="Itens e acessórios"
          section={hasAbout ? undefined : "detalhes"}
        >
          <div id="opcionais" className="scroll-mt-24">
            <VehicleFeatures items={accessories} />
          </div>
        </DossierBlock>
      ) : null}

      {!sold ? (
        <details className="group border-b border-white/10" data-vistoria-garantia="">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-cream [&::-webkit-details-marker]:hidden">
            <span>Saiba mais sobre vistoria e garantia</span>
            <span
              aria-hidden="true"
              className="text-muted transition-transform duration-200 group-open:rotate-180"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3.5 6L8 10.5L12.5 6" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
          </summary>
          <div className="pb-4 text-[15px] leading-relaxed text-cream/80">
            <h3 className="font-display text-sm font-semibold text-cream">{STORE_INSPECTION_LABEL}</h3>
            {inspectionNote && inspectionNote !== STORE_INSPECTION_NOTE ? (
              <p className="mt-1.5 text-cream">{inspectionNote}</p>
            ) : null}
            <p className="mt-1.5">{publicStoreInspectionText(vistoria?.text)}</p>
            {intro || otherConditions.length > 0 ? (
              <h3 className="mt-4 font-display text-sm font-semibold text-cream">{conditions.title}</h3>
            ) : null}
            {intro ? <p className="mt-1.5">{intro}</p> : null}
            {otherConditions.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {otherConditions.map((item) => (
                  <li key={item.label} className="border-l-2 border-brand/80 pl-3">
                    <p className="font-display text-sm font-semibold text-cream">
                      {item.label}
                    </p>
                    <p className="mt-1 text-cream/80">
                      {item.label.toLocaleLowerCase("pt-BR") === "garantia" && warranty
                        ? warranty
                        : item.text}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>
      ) : null}

      <DossierBlock title="Atendimento" id="atendimento">
        <p className="flex items-start gap-2 text-cream">
          <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
          <span>Loja digital em Linhares/ES</span>
        </p>
        <p className="mt-1.5">
          Atendimento com hora marcada pelo WhatsApp. {hours}
        </p>
        {!sold ? (
          <FavoriteButton
            vehicleId={vehicleId}
            label={fullLabel}
            value={price}
            make={make}
            model={model}
            year={yearModel}
            variant="full"
            className="mt-4 w-full"
          />
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <ShareVehicle
            title={fullLabel}
            path={path}
            vehicleId={vehicleId}
            variant="compact"
          />
        </div>
      </DossierBlock>
    </div>
  );
}
