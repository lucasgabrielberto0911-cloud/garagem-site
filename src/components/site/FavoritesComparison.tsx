"use client";

import Link from "next/link";
import { comparisonDifference, differentComparisonText, type ComparisonMetric } from "@/lib/comparison-differences";
import { useEffect, useState } from "react";
import { VehicleImage } from "@/components/VehicleImage";
import type { VehicleCardData } from "./VehicleCard";
import { WhatsAppButton } from "./ui";
import { coverSrc } from "@/lib/stock-query";
import { formatNumberBR, formatVehicleLabel } from "@/lib/format";
import { publicCardFacts } from "@/lib/public-card-facts";
import { formatVehicleWhatsAppMessage } from "@/lib/vehicle-display";
import { vehicleLocationLabel } from "@/lib/vehicle-location";
import { vehiclePath } from "@/lib/vehicle-slug";
import { comparisonSelection, toggleComparison, readComparisonSession, writeComparisonSession } from "@/lib/favorites-comparison";

export function FavoritesComparison({ vehicles }: { vehicles: VehicleCardData[] }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [chosen, setChosen] = useState<string[] | null>(null);
  useEffect(() => {
    const saved = readComparisonSession();
    setChosen(saved.chosen); setOpen(saved.open); setReady(true);
  }, []);
  const ids = comparisonSelection(vehicles.map(vehicle => vehicle.id), chosen);
  const selected = ids.flatMap(id => vehicles.filter(vehicle => vehicle.id === id));
  if (vehicles.length < 2) return null;
  const rows: { label: string; metric?: ComparisonMetric; value: (v: VehicleCardData) => string }[] = [
    { label: "Preço", metric: "price", value: v => publicCardFacts(v).priceLabel.replace(/[\u00a0\u202f]/g, " ") || "Consulte" },
    { label: "Versão", value: v => v.version?.trim() || "—" },
    { label: "Ano", metric: "yearModel", value: v => String(v.yearModel) },
    { label: "Km", metric: "km", value: v => formatNumberBR(v.km) + " km" },
    { label: "Câmbio", value: v => publicCardFacts(v).facts.find(fact => fact.label === "Câmbio")?.value || "—" },
    { label: "Cidade", value: v => vehicleLocationLabel(v.locationCity) || "—" },
  ];
  return (
    <details open={open} onToggle={event => {
      if (!ready) return;
      const next = event.currentTarget.open; setOpen(next);
      writeComparisonSession({ chosen: chosen === null ? null : ids, open: next });
    }} className="group mt-6 rounded-xl border border-white/15 bg-ink">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-display text-sm font-semibold text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        Comparar favoritos
        <span className="text-xs font-normal text-muted">{ids.length} selecionados <span aria-hidden="true" className="ml-2 inline-block transition-transform group-open:rotate-180">⌄</span></span>
      </summary>
      <div className="border-t border-white/10 p-3 sm:p-4">
        <p className="text-sm leading-relaxed text-muted">Escolha dois ou três veículos. Com dois, os dados ficam lado a lado no celular.</p>
        <fieldset className="mt-3 flex flex-wrap gap-2">
          <legend className="sr-only">Veículos para comparar, no máximo três</legend>
          {vehicles.map(vehicle => {
            const checked = ids.includes(vehicle.id);
            return <label key={vehicle.id} className={"flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed " + (checked ? "border-brand/60 bg-brand/10 text-cream" : "border-white/15 text-muted")}>
              <input type="checkbox" checked={checked} disabled={!checked && ids.length >= 3} onChange={() => { const next = toggleComparison(ids, vehicle.id); setChosen(next); writeComparisonSession({ chosen: next, open }); }} className="h-4 w-4 shrink-0 accent-[#ed1018]" />
              <span>{formatVehicleLabel(vehicle.brand, vehicle.model, vehicle.yearModel)}{vehicle.version ? " · " + vehicle.version : ""}</span>
            </label>;
          })}
        </fieldset>
        <p role="status" className="mt-3 text-xs leading-relaxed text-muted">{ids.length < 2 ? "Selecione mais um veículo para comparar." : ids.length === 3 ? "Para trocar uma opção, desmarque um veículo. Deslize a comparação para ver os três." : "Dois selecionados. Você pode adicionar mais um ou trocar as opções."}</p>
        {selected.length >= 2 ? <p className="mt-2 text-xs leading-relaxed text-muted">Diferenças em relação ao {formatVehicleLabel(selected[0].brand, selected[0].model)} da primeira coluna. Os campos diferentes têm um fundo mais claro.</p> : null}
        {selected.length >= 2 ? <div className="mt-4 max-h-[70dvh] overflow-auto overscroll-contain rounded-lg border border-white/10" tabIndex={0} aria-label="Tabela de comparação dos veículos selecionados">
          <table className="w-full table-fixed border-collapse text-left" style={selected.length === 3 ? { minWidth: "28rem" } : undefined}>
            <caption className="sr-only">Comparação por preço, versão, ano, quilometragem, câmbio e cidade</caption>
            <thead className="sticky top-0 z-20 bg-ink">
              <tr className="align-top">
                <th scope="col" className="sticky left-0 z-30 w-12 bg-ink px-1 py-3 text-[10px] font-medium text-muted sm:w-20 sm:px-2">Veículo</th>
                {selected.map(vehicle => <th key={vehicle.id} scope="col" className="border-l border-white/10 p-2 font-normal">
                  <Link href={vehiclePath(vehicle)} className="block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-asphalt"><VehicleImage src={coverSrc(vehicle.photos?.slice(0, 1).map(photo => ({ url: photo.url })))} alt={formatVehicleLabel(vehicle.brand, vehicle.model, vehicle.yearModel)} fill sizes="180px" className="object-cover" /></div>
                    <span className="mt-2 block text-xs font-semibold leading-relaxed text-cream sm:text-sm">{formatVehicleLabel(vehicle.brand, vehicle.model)}</span>
                  </Link>
                </th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => <tr key={row.label} className="border-t border-white/10 align-top">
                <th scope="row" className="sticky left-0 z-10 bg-ink px-1 py-3 text-[10px] font-medium text-muted sm:px-2 sm:text-xs">{row.label}</th>
                {selected.map((vehicle, index) => {
                  const note = index > 0 && row.metric ? comparisonDifference(row.metric, vehicle[row.metric], selected[0][row.metric]) : null;
                  const differs = index > 0 && (row.metric ? Boolean(note) : differentComparisonText(row.value(vehicle), row.value(selected[0])));
                  return <td key={vehicle.id} data-comparison-difference={differs ? "" : undefined} className={"border-l border-white/10 px-2 py-3 leading-relaxed " + (differs ? "bg-white/[0.045] " : "") + (row.label === "Preço" ? "font-display text-sm font-semibold text-brand sm:text-lg" : "text-xs text-cream sm:text-sm")}>
                    {row.value(vehicle)}
                    {note ? <span className="mt-1 block font-sans text-[10px] font-normal leading-relaxed text-muted sm:text-xs">{note}</span> : null}
                  </td>;
                })}
              </tr>)}
              <tr className="border-t border-white/10 align-top">
                <th scope="row" className="sticky left-0 z-10 bg-ink px-1 py-3 text-[10px] font-medium text-muted sm:px-2">Contato</th>
                {selected.map(vehicle => <td key={vehicle.id} className="border-l border-white/10 p-2">
                  <WhatsAppButton message={formatVehicleWhatsAppMessage(vehicle)} trackingLabel="comparacao-favoritos" vehicleId={vehicle.id} variant="outline" className="!h-14 !min-h-14 w-full !gap-1 !py-2 !whitespace-normal !border-emerald-500/30 bg-[#11231a] !px-1 !text-[10px] !tracking-normal hover:!bg-[#183225] [&_svg]:shrink-0 [&_svg]:!h-3.5 [&_svg]:!w-3.5 [&_svg]:text-[#25d366] sm:!text-xs"><span className="min-w-0 text-center">Tenho interesse</span></WhatsAppButton>
                  <Link href={vehiclePath(vehicle)} className="mt-1 flex min-h-11 items-center justify-center text-xs text-cream underline underline-offset-4">Abrir anúncio</Link>
                </td>)}
              </tr>
            </tbody>
          </table>
        </div> : null}
      </div>
    </details>
  );
}
