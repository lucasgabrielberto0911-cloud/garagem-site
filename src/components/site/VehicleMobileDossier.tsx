import type { ReactNode } from "react";
import Link from "next/link";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { ShareVehicle } from "@/components/site/ShareVehicle";
import { VehicleFeatures } from "@/components/site/VehicleFeatures";
import { VehicleInspectionBadge } from "@/components/site/VehicleInspectionBadge";
import { VehicleDescription, visibleDescriptionSegments } from "@/components/site/VehicleDescription";
import { VehicleQuickActions } from "@/components/site/VehicleQuickActions";
import { VehicleSeals } from "@/components/site/VehicleSeals";
import { IconClipboardCheck, IconMapPin, IconShieldCheck } from "@/components/site/icons";
import { site } from "@/lib/site";
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
const FOLD_LABELS = new Set(["Ano", "km", "Câmbio", "Combustível", "Final placa"]);
/** Garantia e vistoria já aparecem na faixa de confiança. */
const TRUST_LABELS = new Set(["Garantia", STORE_INSPECTION_LABEL]);

function sheetSpecs(specs: VehicleSpecRow[]) {
  return specs.filter((row) => !FOLD_LABELS.has(row.label) && !TRUST_LABELS.has(row.label));
}

/** A âncora Especificações cai na ficha técnica quando ela existe. */
export function hasMobileFichaSpecs(specs: VehicleSpecRow[]) {
  return sheetSpecs(specs).length > 0;
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
  fuel,
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
  fuel?: string | null;
  plateEnd?: string | null;
  inspection?: string | null;
  /** Selos já filtrados (sem dado = sem selo). */
  seals?: readonly VehicleSeal[];
  /** Quando a ficha técnica não existe, a âncora aponta para estes fatos. */
  specAnchor?: boolean;
}) {
  const plate = (plateEnd ?? "").replace(/\s+/g, " ").trim();
  const fuelText = (fuel ?? "").trim();
  const facts = [
    { label: "Ano", value: formatVehicleYearRange(year, yearModel) },
    { label: "Km", value: formatNumberBR(km) },
    { label: "Câmbio", value: transmission.trim() || SPEC_EMPTY },
    ...(fuelText && fuelText !== SPEC_EMPTY ? [{ label: "Combustível", value: fuelText }] : []),
    ...(plate ? [{ label: "Final da placa", value: plate }] : []),
  ];

  return (
    <div className="ficha-mobile-sheet px-4 pb-3 pt-3 sm:px-6">
      <h1 className="break-normal whitespace-normal font-display text-[1.25rem] font-bold leading-snug tracking-tight text-cream">
        {title}
      </h1>
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
      {!sold ? <VehicleSeals seals={seals} className="mt-2.5" optionalsHref="#opcionais" /> : null}
      <dl
        className={`mt-2.5 grid grid-cols-2 gap-1.5${specAnchor ? " ficha-jump-target" : ""}`}
        id={specAnchor ? "especificacoes" : undefined}
        data-ficha-section={specAnchor ? "especificacoes" : undefined}
      >
        {facts.map((fact, index) => (
          <div
            key={fact.label}
            className={`min-w-0 border border-white/10 bg-ink px-2.5 py-2${
              facts.length % 2 === 1 && index === facts.length - 1 ? " col-span-2" : ""
            }`}
          >
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {fact.label}
            </dt>
            <dd className="mt-0.5 font-display text-[13px] font-semibold leading-tight text-cream">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
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

const TRUST_PILLS = [
  { Icon: IconShieldCheck, label: "Garantia de 3 meses (motor e câmbio)" },
  { Icon: IconClipboardCheck, label: "Vistoria da loja" },
  { Icon: IconMapPin, label: "Linhares/ES" },
] as const;

/** Confiança sempre visível: garantia, vistoria e cidade, sem clicar. */
function VehicleTrustStrip() {
  return (
    <ul
      aria-label="Garantia e vistoria"
      data-trust-strip=""
      className="grid gap-2 border-b border-white/10 py-4"
    >
      {TRUST_PILLS.map(({ Icon, label }) => (
        <li key={label} className="flex items-center gap-2.5 text-sm leading-snug text-cream">
          <Icon className="h-5 w-5 shrink-0 text-brand-light" />
          {label}
        </li>
      ))}
    </ul>
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
    visibleDescriptionSegments(description, summaryFacts, true).length > 0;

  return (
    <div className="mt-2 lg:hidden">
      {!sold ? <VehicleTrustStrip /> : null}

      {verified.length > 0 ? (
        <DossierBlock title={verifiedHeading ?? "Verificado neste carro"}>
          <VehicleVerifiedList items={verified} alt={fullLabel} showVideoHint={!sold} />
        </DossierBlock>
      ) : null}

      {hasAbout ? (
        <DossierBlock title="Sobre o veículo" section="detalhes">
          <VehicleDescription text={description!} summaryFacts={summaryFacts} hideSpecLines />
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

      {extraSpecs.length > 0 ? (
        <DossierBlock title="Ficha técnica" section="especificacoes">
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
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-cream">
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

      {!sold && quickActions ? (
        <DossierBlock title="Próximos passos" id="proximos-passos">
          <p>Financiamento, troca, vídeo ou visita — a gente responde no WhatsApp.</p>
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
        </DossierBlock>
      ) : null}

      <DossierBlock title="Onde estamos" id="onde-estamos">
        <p className="flex items-start gap-2 text-cream">
          <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
          <span>Linhares/ES — {site.address}</span>
        </p>
        <p className="mt-1.5">{site.hours}</p>
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
        <ShareVehicle
          title={fullLabel}
          path={path}
          vehicleId={vehicleId}
          className="mt-3"
        />
        {!sold ? (
          <Link
            href={`/vender?interesse=${vehicleId}&label=${encodeURIComponent(fullLabel)}`}
            prefetch={false}
            className="mt-3 inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-cream hover:underline"
          >
            Ou preencha a avaliação do seu usado
          </Link>
        ) : null}
      </DossierBlock>
    </div>
  );
}
