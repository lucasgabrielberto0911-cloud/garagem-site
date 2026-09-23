import type { ReactNode } from "react";
import Link from "next/link";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { GoogleReviewsBadge } from "@/components/site/GoogleReviewsBadge";
import { ShareVehicle } from "@/components/site/ShareVehicle";
import { VehicleLeadHit } from "@/components/site/VehiclePixel";
import { VehicleQuickActions } from "@/components/site/VehicleQuickActions";
import { VehicleTrustNotes } from "@/components/site/VehicleTrustNotes";
import { WhatsAppButton } from "@/components/site/ui";
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
  publishedConditionItems,
  type VehicleConditionsContent,
} from "@/lib/vehicle-conditions";
import { vehicleLocationLabel } from "@/lib/vehicle-location";

const FOLD_LABELS = new Set(["Ano", "KM", "Câmbio", "Disponível em"]);

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
  soldHref,
  soldLabel,
  whatsapp,
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
  soldHref: string;
  soldLabel: string;
  whatsapp: {
    contentId: string;
    contentName: string;
    make: string;
    model: string;
    message: string;
    trackingContent?: string;
  };
}) {
  const facts = [
    { label: "Ano", value: formatVehicleYearRange(year, yearModel) },
    { label: "Km", value: formatNumberBR(km) },
    { label: "Câmbio", value: transmission.trim() || SPEC_EMPTY },
    { label: "Cidade", value: city.trim() || SPEC_EMPTY_FEMININE },
  ];

  return (
    <div className="ficha-mobile-sheet px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 sm:px-6">
      <h1 className="line-clamp-2 font-display text-xl font-bold leading-tight tracking-tight text-cream">
        {title}
      </h1>
      {version ? (
        <p className="mt-0.5 line-clamp-1 text-xs text-muted">{version}</p>
      ) : null}
      <p className="mt-1.5 font-display text-[1.7rem] font-bold leading-none tracking-tight text-brand">
        {sold ? (
          <span className="text-muted line-through decoration-white/30">
            {formatCurrencyBRL(price)}
          </span>
        ) : (
          formatCurrencyBRL(price)
        )}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-px border border-white/15 bg-white/15">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0 bg-asphalt px-3 py-2">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              {fact.label}
            </dt>
            <dd className="mt-0.5 truncate font-display text-[13px] font-semibold text-cream">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
      <div id="ficha-whatsapp" className="mt-3">
        {sold ? (
          <Link
            href={soldHref}
            className="inline-flex min-h-[52px] w-full items-center justify-center bg-brand px-5 font-display text-sm font-semibold uppercase tracking-wide text-cream"
          >
            {soldLabel}
          </Link>
        ) : (
          <VehicleLeadHit
            contentId={whatsapp.contentId}
            contentName={whatsapp.contentName}
            value={price}
            make={whatsapp.make}
            model={whatsapp.model}
            year={yearModel}
          >
            <WhatsAppButton
              size="lg"
              className="w-full"
              trackingLabel="ficha"
              campaign="ficha"
              content={whatsapp.trackingContent}
              message={whatsapp.message}
            >
              Tenho interesse
            </WhatsAppButton>
          </VehicleLeadHit>
        )}
      </div>
    </div>
  );
}

function DossierBlock({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group border-b border-white/10" open={defaultOpen}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 font-display text-sm font-semibold text-cream [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="text-base font-normal text-muted group-open:hidden" aria-hidden="true">
          +
        </span>
        <span className="hidden text-base font-normal text-muted group-open:inline" aria-hidden="true">
          –
        </span>
      </summary>
      <div className="pb-3.5 text-sm leading-relaxed text-muted">{children}</div>
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
  accessories: string[];
  specs: VehicleSpecRow[];
  inspection?: string | null;
  conditions: VehicleConditionsContent;
  listedLine?: string;
  google: GoogleReviews;
  prompt: string;
  quickActions?: {
    contentPath: string;
    video: string;
    finance: string;
    trade: string;
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
    <div className="mt-2 border-t border-white/10 lg:hidden">
      <DossierBlock title={STORE_INSPECTION_LABEL}>
        {inspectionNote && inspectionNote !== STORE_INSPECTION_NOTE ? (
          <p className="mb-2 text-cream">{inspectionNote}</p>
        ) : null}
        <p>
          {vistoria?.text ??
            "Antes de entrar no estoque, o seminovo passa pela vistoria da loja: checagem interna de procedência e condição geral. Não é documento oficial de inspeção."}
        </p>
      </DossierBlock>

      {extraSpecs.length > 0 ? (
        <DossierBlock title="Ficha">
          {listedLine ? <p className="mb-2 text-xs">{listedLine}</p> : null}
          <dl className="grid grid-cols-2 gap-px border border-white/15 bg-white/15">
            {extraSpecs.map((spec) => (
              <div key={spec.label} className="min-w-0 bg-asphalt px-2.5 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted">
                  {spec.label}
                </dt>
                <dd
                  className={`mt-0.5 font-display text-sm leading-snug [overflow-wrap:anywhere] ${
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

      {description ? (
        <DossierBlock title="Sobre o veículo">
          <p className="whitespace-pre-line">{description}</p>
        </DossierBlock>
      ) : null}

      {accessories.length > 0 ? (
        <DossierBlock title="Itens e acessórios" defaultOpen>
          <ul className="space-y-1.5 text-cream/90">
            {accessories.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 bg-brand" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </DossierBlock>
      ) : null}

      {conditions.intro || otherConditions.length > 0 ? (
        <DossierBlock title="Garantia e condições">
          {conditions.intro ? <p>{conditions.intro}</p> : null}
          {otherConditions.length > 0 ? (
            <ul className={conditions.intro ? "mt-3 space-y-2.5" : "space-y-2.5"}>
              {otherConditions.map((item) => (
                <li key={item.label}>
                  <span className="font-display font-semibold text-cream">
                    {item.label}.{" "}
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          ) : null}
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
              contentPath={quickActions.contentPath}
              contentName={fullLabel}
              value={price}
              make={make}
              model={model}
              year={yearModel}
              video={quickActions.video}
              finance={quickActions.finance}
              trade={quickActions.trade}
              className="grid"
            />
          </div>
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
        {!sold ? (
          <ChatOpenButton
            source="ficha"
            prompt={prompt}
            size="lg"
            variant="solid"
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
            className="mt-3 inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:text-cream hover:underline"
          >
            Ou preencha a avaliação do seu usado
          </Link>
        ) : null}
        <ShareVehicle
          title={fullLabel}
          path={path}
          className="mt-3 border-t border-white/10 pt-3"
        />
      </DossierBlock>
    </div>
  );
}
