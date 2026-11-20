import Link from "next/link";
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
import { publicDossierChips } from "@/lib/vehicle-dossier";
import type { VehicleSeal } from "@/lib/vehicle-seals";

/** Garantia e vistoria já aparecem na faixa de confiança. */
const TRUST_LABELS = new Set(["Garantia", STORE_INSPECTION_LABEL]);

/** Já estão no topo da ficha (quadradinhos, cor ao lado do preço) ou não dizem nada ("Tipo: Carro"). */
const TOP_LABELS = new Set(["Tipo", "Ano", "km", "Câmbio", "Combustível", "Cor"]);

/**
 * Ficha técnica do celular: só o que ainda não apareceu acima (motor, portas, final de placa...).
 * Sem repetir o topo e sem linha "Não informada".
 */
export function sheetSpecs(specs: VehicleSpecRow[]) {
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

export function VehicleMobileKeyFacts({
  facts,
  color,
  yearLabel,
  specAnchor = false,
  className = "mt-2.5",
}: {
  facts: readonly VehicleKeyFact[];
  color?: string | null;
  yearLabel?: string;
  specAnchor?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${className}${specAnchor ? " ficha-jump-target" : ""}`.trim()}
      id={specAnchor ? "especificacoes" : undefined}
      data-ficha-section={specAnchor ? "especificacoes" : undefined}
    >
      <VehicleKeyFacts {...topFacts(facts, color, yearLabel)} />
    </div>
  );
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
  hasSpareKey,
  hasManual,
  hasVideo,
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
  hasSpareKey?: boolean | null;
  hasManual?: boolean | null;
  hasVideo?: boolean | null;
  /** Quando a ficha técnica não existe, a âncora aponta para estes fatos. */
  specAnchor?: boolean;
}) {
  const dossierChips = sold
    ? []
    : publicDossierChips({ hasSpareKey, hasManual, hasVideo });
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
      <p
        data-ficha-price=""
        className="mt-1.5 font-display text-[1.75rem] font-bold leading-none tracking-tight tabular-nums text-brand-light"
      >
        {sold ? (
          <span className="text-base text-cream/80">Já vendido</span>
        ) : (
          <span className="ficha-price">{formatCurrencyBRL(price)}</span>
        )}
      </p>
      {/* Logo abaixo do preço: é o que ainda cabe na primeira tela em celular baixo. */}
      {!sold ? <VehicleTrustNotes warranty={warranty} compact className="mt-2.5" /> : null}
      <VehicleMobileKeyFacts
        facts={facts}
        color={color}
        yearLabel={yearLabel}
        specAnchor={specAnchor}
      />
      {!sold ? (
        <VehicleInspectionBadge inspection={inspection} className="mt-2.5" />
      ) : null}
      {!sold ? (
        <VehicleSeals
          seals={seals.filter((seal) => seal.id !== "opcionais")}
          chips={dossierChips}
          className="mt-2.5"
        />
      ) : null}
    </div>
  );
}

/** Bloco sempre aberto: título em Sora, sem acordeão. */
function DossierBlock({
  title,
  children,
  section,
  id,
  surface = "base",
  divider = "none",
}: {
  title: string;
  children: ReactNode;
  section?: "especificacoes" | "detalhes";
  id?: string;
  surface?: "base" | "alt";
  divider?: "top" | "none";
}) {
  const surfaceClass =
    surface === "alt" ? "-mx-4 bg-ink/70 px-4 sm:-mx-6 sm:px-6" : "";
  const dividerClass = divider === "top" ? "border-t border-white/[0.12]" : "";

  return (
    <section
      className={["py-5", surfaceClass, dividerClass, section ? "ficha-jump-target" : ""].filter(Boolean).join(" ")}
      id={id ?? section}
      data-ficha-section={section}
    >
      <h2 className="mb-3 font-display text-lg font-bold tracking-tight text-cream">{title}</h2>
      <div className="text-[15px] leading-relaxed text-cream/90">{children}</div>
    </section>
  );
}

export function VehicleMobileBlocks({
  fullLabel,
  path,
  sold,
  catalog = false,
  status,
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
  /** `true` só para disponível do estoque próprio (Meta). */
  catalog?: boolean;
  status?: string;
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
    hasVideo?: boolean;
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
  const hasSteps = !sold && !!quickActions;
  const hasBaseBeforeDetails =
    verified.length > 0 || hasAbout || accessories.length > 0;

  return (
    <div className="mt-2 pb-6 lg:hidden">
      {extraSpecs.length === 0 && listedLine ? (
        // Sem ficha técnica, o "Anunciado hoje · Atualizado em..." continua como linha solta.
        <p className="border-t border-white/[0.12] pb-4 pt-4 text-sm tracking-wide text-muted">{listedLine}</p>
      ) : null}
      {extraSpecs.length > 0 ? (
        <DossierBlock title="Ficha técnica" section="especificacoes" divider="top">
          {listedLine ? (
            <p className="mb-3 text-sm tracking-wide text-muted">{listedLine}</p>
          ) : null}
          <dl className="ficha-spec-grid grid grid-cols-2 gap-2">
            {extraSpecs.map((spec) => (
              <div key={spec.label} className="min-w-0 border border-white/15 bg-ink px-3 py-2.5">
                <dt className="text-sm font-normal text-muted">{spec.label}</dt>
                <dd
                  className={`mt-1 font-display text-[15px] leading-snug [overflow-wrap:break-word] ${
                    spec.empty ? "font-medium text-muted" : "font-bold text-cream"
                  }`}
                >
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>
        </DossierBlock>
      ) : null}

      {hasSteps ? (
        <DossierBlock title="Próximos passos" id="proximos-passos" surface="alt">
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
              catalog={catalog}
              status={status}
              sold={sold}
              video={quickActions.video}
              finance={quickActions.finance}
              trade={quickActions.trade}
              visit={quickActions.visit}
              hasVideo={quickActions.hasVideo}
              variant="secondary"
              className="grid"
            />
          </div>
        </DossierBlock>
      ) : null}

      {verified.length > 0 ? (
        <DossierBlock
          title={verifiedHeading ?? "Verificado neste carro"}
          divider={hasSteps ? "none" : "top"}
        >
          <VehicleVerifiedList items={verified} alt={fullLabel} showVideoHint={!sold} />
        </DossierBlock>
      ) : null}

      {hasAbout ? (
        <DossierBlock
          title="Sobre o veículo"
          section="detalhes"
          divider={verified.length > 0 || !hasSteps ? "top" : "none"}
        >
          <VehicleDescription text={description!} summaryFacts={summaryFacts} specRows={specs} hideEmoji />
        </DossierBlock>
      ) : null}

      {accessories.length > 0 ? (
        <DossierBlock
          title="Itens e acessórios"
          section={hasAbout ? undefined : "detalhes"}
          divider={hasAbout || verified.length > 0 || !hasSteps ? "top" : "none"}
        >
          <div id="opcionais" className="scroll-mt-24">
            <VehicleFeatures items={accessories} />
          </div>
        </DossierBlock>
      ) : null}

      {!sold ? (
        <details
          className={`group${hasBaseBeforeDetails || !hasSteps ? " border-t border-white/[0.12]" : ""}`}
          data-vistoria-garantia=""
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-display text-[15px] font-semibold text-cream [&::-webkit-details-marker]:hidden">
            <span>Saiba mais sobre vistoria e garantia</span>
            <span
              aria-hidden="true"
              className="text-cream transition-transform duration-200 group-open:rotate-180"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3.5 6L8 10.5L12.5 6" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
          </summary>
          <div className="pb-4 text-[15px] leading-relaxed text-cream/90">
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
                    <p className="mt-1 text-cream/85">
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

      <DossierBlock title="Atendimento" id="atendimento" surface="alt">
        <p className="flex items-start gap-2 font-medium text-cream">
          <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
          <span>Atendemos Linhares, Aracruz e Grande Vitória</span>
        </p>
        <p className="mt-1.5 text-cream/85">
          Combinamos o atendimento pelo WhatsApp. {hours}
        </p>
        {!sold && path.startsWith("/estoque/") ? (
          <p className="mt-2.5 text-sm">
            <Link
              href={`/troca?carro=${encodeURIComponent(
                path.slice("/estoque/".length).split(/[?#]/)[0].replace(/\/+$/, ""),
              )}`}
              prefetch={false}
              className="inline-flex min-h-11 items-center text-cream/90 underline decoration-white/35 underline-offset-4 transition hover:text-cream hover:decoration-brand"
            >
              Tem carro pra dar na troca?
            </Link>
          </p>
        ) : null}
        {!sold ? (
          <FavoriteButton
            vehicleId={vehicleId}
            label={fullLabel}
            value={price}
            make={make}
            model={model}
            year={yearModel}
            catalog={catalog}
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
