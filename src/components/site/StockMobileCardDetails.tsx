import { StockVehicleLink } from "@/components/site/StockVehicleLink";
import { VehicleCardWhatsApp } from "@/components/site/VehicleCardWhatsApp";
import { formatBrandName, formatModelName } from "@/lib/format";
import { publicCardFacts, type PublicCardFact } from "@/lib/public-card-facts";
import type { VehicleCardRecord } from "@/lib/stock-query";
import {
  collapseWhitespace,
  formatVehicleDisplay,
  formatVehicleWhatsAppMessage,
} from "@/lib/vehicle-display";

/** Linhas compartilhadas pelo par de cards: nenhum fato é abreviado ou cortado. */
export function StockMobileCardDetails({
  vehicle,
  returnTo,
}: {
  vehicle: VehicleCardRecord;
  returnTo?: string;
}) {
  const card = publicCardFacts(vehicle);
  const display = formatVehicleDisplay(vehicle);
  const byLabel = new Map(card.facts.map((fact) => [fact.label, fact]));
  const version = collapseWhitespace(vehicle.version ?? "");

  return (
    <div className="stock-mobile-details">
      <h3 className="stock-mobile-title font-display">{card.title}</h3>
      <dl className="stock-mobile-facts">
        <div className="stock-mobile-version stock-mobile-fact-row">
          <Fact fact={version ? { label: "Versão", value: version } : undefined} />
        </div>
        <div className="stock-mobile-fact-row stock-mobile-year-km">
          <Fact fact={byLabel.get("Ano")} />
          <Fact fact={byLabel.get("Km")} />
        </div>
        <div className="stock-mobile-fact-row">
          <Fact fact={byLabel.get("Câmbio")} />
        </div>
        <div className="stock-mobile-fact-row">
          <Fact fact={byLabel.get("Cidade")} />
        </div>
      </dl>
      <div className="stock-mobile-price-row">
        {card.priceLabel ? (
          <p className="stock-mobile-price font-display">{card.priceLabel}</p>
        ) : null}
      </div>
      <StockVehicleLink
        href={display.path}
        returnTo={returnTo}
        ariaLabel={`Ver ficha de ${display.titleWithYear}`}
        className="stock-mobile-view font-display"
      >
        Ver ficha
      </StockVehicleLink>
      <div className="stock-mobile-interest">
        {vehicle.status !== "vendido" ? (
          <VehicleCardWhatsApp
            showOnStockList
            vehicleId={vehicle.id}
            label={display.fullLabel}
            message={formatVehicleWhatsAppMessage({
              ...vehicle,
              path: display.path,
              isMoto: vehicle.category === "moto",
            })}
            value={vehicle.price}
            make={formatBrandName(vehicle.brand)}
            model={formatModelName(vehicle.model)}
            year={vehicle.yearModel}
            path={display.path}
            campaign="estoque"
          />
        ) : null}
      </div>
    </div>
  );
}

function Fact({ fact }: { fact?: PublicCardFact | { label: "Versão"; value: string } }) {
  if (!fact) return null;
  return (
    <div className="stock-mobile-fact">
      <dt className="sr-only">{fact.label}</dt>
      <dd>{fact.value}</dd>
    </div>
  );
}
