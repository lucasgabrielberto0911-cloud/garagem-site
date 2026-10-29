"use client";

import Link from "next/link";
import { comparisonDifference, differentComparisonText, type ComparisonMetric } from "@/lib/comparison-differences";
import { useEffect, useId, useRef, useState } from "react";
import { VehicleImage } from "@/components/VehicleImage";
import type { VehicleCardData } from "./VehicleCard";
import { WhatsAppButton } from "./ui";
import { coverSrc } from "@/lib/stock-query";
import { formatVehicleLabel } from "@/lib/format";
import { publicCardFacts } from "@/lib/public-card-facts";
import { formatVehicleWhatsAppMessage } from "@/lib/vehicle-display";
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
    { label: "Preço", metric: "price", value: v => publicCardFacts(v).priceLabel.replace(/[\u00a0\u202f]/g, " ") || "Não informado" },
    { label: "Versão", value: v => v.version?.trim() || "Não informado" },
    { label: "Ano", metric: "yearModel", value: v => publicCardFacts(v).facts.find(fact => fact.label === "Ano")?.value || "Não informado" },
    { label: "Quilometragem", metric: "km", value: v => publicCardFacts(v).facts.find(fact => fact.label === "Km")?.value || "Não informado" },
    { label: "Câmbio", value: v => publicCardFacts(v).facts.find(fact => fact.label === "Câmbio")?.value || "Não informado" },
  ];
  return (
    <div className="mt-6 min-w-0">
      <p className="mb-2 text-sm leading-relaxed text-muted">Você já pode comparar seus favoritos lado a lado.</p>
    <details open={open} onToggle={event => {
      if (!ready) return;
      const next = event.currentTarget.open; setOpen(next);
      writeComparisonSession({ chosen: chosen === null ? null : ids, open: next });
    }} className="group rounded-xl border border-white/15 bg-ink">
      <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 font-display text-sm font-semibold text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <span>Comparar favoritos <span className="ml-1 text-xs font-normal text-muted">Até 3</span></span>
        <span className="text-xs font-normal text-muted">{ids.length} selecionados <span aria-hidden="true" className="ml-2 inline-block transition-transform group-open:rotate-180">⌄</span></span>
      </summary>
      <div className="border-t border-white/10 p-3 sm:p-4">
        <p className="text-sm leading-relaxed text-muted">Escolha dois ou três veículos. Deslize a tabela para ver todas as colunas; os rótulos ficam fixos.</p>
        <fieldset className="mt-3 flex flex-wrap gap-2">
          <legend className="sr-only">Veículos para comparar, no máximo três</legend>
          {vehicles.map(vehicle => {
            const checked = ids.includes(vehicle.id);
            return <label key={vehicle.id} className={"flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed " + (checked ? "border-brand/60 bg-brand/10 text-cream" : "border-white/15 text-muted")}>
              <input type="checkbox" checked={checked} disabled={!checked && ids.length >= 3} onChange={() => { const next = toggleComparison(ids, vehicle.id); setChosen(next); writeComparisonSession({ chosen: next, open }); }} className="h-4 w-4 shrink-0 accent-brand" />
              <span className="min-w-0 break-words">{formatVehicleLabel(vehicle.brand, vehicle.model, vehicle.yearModel)}{vehicle.version ? " · " + vehicle.version : ""}</span>
            </label>;
          })}
        </fieldset>
        <p role="status" className="mt-3 text-xs leading-relaxed text-muted">{ids.length < 2 ? "Selecione mais um veículo para comparar." : ids.length === 3 ? "Para trocar uma opção, desmarque um veículo. Deslize a comparação para ver os três." : "Dois selecionados. Você pode adicionar mais um ou trocar as opções."}</p>
        {selected.length >= 2 ? <p className="mt-2 text-xs leading-relaxed text-muted">Diferenças em relação ao {formatVehicleLabel(selected[0].brand, selected[0].model)} da primeira coluna. Os campos diferentes têm um fundo mais claro.</p> : null}
        {selected.length >= 2 ? <ComparisonTable selected={selected} rows={rows} /> : null}
      </div>
    </details>
    </div>
  );
}


type ComparisonRow = { label: string; metric?: ComparisonMetric; value: (vehicle: VehicleCardData) => string };

function ComparisonTable({ selected, rows }: { selected: VehicleCardData[]; rows: ComparisonRow[] }) {
  const tableRef = useRef<HTMLDivElement>(null);
  const tableId = useId();
  function showColumn(index: number) {
    const viewport = tableRef.current;
    const columns = viewport?.querySelectorAll<HTMLElement>("thead th");
    const column = columns?.[index + 1];
    if (!viewport || !column || !columns?.[0]) return;
    const left = viewport.scrollLeft + column.getBoundingClientRect().left
      - viewport.getBoundingClientRect().left - viewport.clientLeft - columns[0].getBoundingClientRect().width;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollTo({ left: Math.max(0, left), behavior: reduced ? "auto" : "smooth" });
  }
  return <>
    <div className="mt-3 lg:hidden">
      <p className="text-xs leading-relaxed text-muted">Toque para ver a coluna de cada veículo. Você também pode deslizar a tabela.</p>
      <div className={"mt-2 grid gap-2 " + (selected.length === 3 ? "grid-cols-3" : "grid-cols-2")} role="group" aria-label="Ver colunas da comparação">
        {selected.map((vehicle, index) => <button key={vehicle.id} type="button"
          aria-controls={tableId} aria-label={`Mostrar ${formatVehicleLabel(vehicle.brand, vehicle.model, vehicle.yearModel)}${vehicle.version ? " · " + vehicle.version : ""} na comparação`}
          onClick={() => showColumn(index)}
          className="min-h-11 min-w-0 rounded-md border border-white/20 px-2 py-2 text-xs leading-relaxed text-cream transition hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
          {formatVehicleLabel(vehicle.brand, vehicle.model)}
        </button>)}
      </div>
    </div>
      <div ref={tableRef} id={tableId} role="region" className="mt-3 max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-white/10 [container-type:inline-size] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" tabIndex={0} aria-label="Tabela de comparação dos veículos selecionados">
          <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: `calc(7rem + ${selected.length} * min(12rem, 100cqw - 7rem))` }}>
            <caption className="sr-only">Comparação por preço, versão, ano, quilometragem e câmbio</caption>
            <thead className="bg-ink">
              <tr className="align-top">
                <th scope="col" className="sticky left-0 z-30 w-28 bg-ink px-2 py-3 text-xs font-medium text-cream">Veículo</th>
                {selected.map(vehicle => <th key={vehicle.id} scope="col" className="break-words border-l border-white/10 p-2 font-normal">
                  <Link href={vehiclePath(vehicle)} className="block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-asphalt"><VehicleImage src={coverSrc(vehicle.photos)} alt={formatVehicleLabel(vehicle.brand, vehicle.model, vehicle.yearModel)} fill sizes="180px" className="object-cover" /></div>
                    <span className="mt-2 block text-xs font-semibold leading-relaxed text-cream sm:text-sm">{formatVehicleLabel(vehicle.brand, vehicle.model)}</span>
                  </Link>
                </th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => <tr key={row.label} className="border-t border-white/10 align-top">
                <th scope="row" className="sticky left-0 z-10 bg-ink px-2 py-3 text-xs font-medium text-cream">{row.label}</th>
                {selected.map((vehicle, index) => {
                  const informed = row.value(vehicle) !== "Não informado" && row.value(selected[0]) !== "Não informado";
                  const note = index > 0 && informed && row.metric ? comparisonDifference(row.metric, vehicle[row.metric], selected[0][row.metric]) : null;
                  const differs = index > 0 && informed && (row.metric ? Boolean(note) : differentComparisonText(row.value(vehicle), row.value(selected[0])));
                  return <td key={vehicle.id} data-comparison-difference={differs ? "" : undefined} className={"break-words border-l border-white/10 px-2 py-3 leading-relaxed " + (differs ? "bg-white/[0.045] " : "") + (row.label === "Preço" ? "font-display text-sm font-semibold text-brand-light sm:text-lg" : "text-xs text-cream sm:text-sm")}>
                    {row.value(vehicle)}
                    {note ? <span className="mt-1 block font-body text-xs font-normal leading-relaxed text-muted">{note}</span> : null}
                  </td>;
                })}
              </tr>)}
              <tr className="border-t border-white/10 align-top">
                <th scope="row" className="sticky left-0 z-10 bg-ink px-2 py-3 text-xs font-medium text-cream">Contato</th>
                {selected.map(vehicle => <td key={vehicle.id} className="border-l border-white/10 p-2">
                  <WhatsAppButton message={formatVehicleWhatsAppMessage({
                    ...vehicle,
                    path: vehiclePath(vehicle),
                    isMoto: vehicle.category === "moto",
                  })} trackingLabel="comparacao-favoritos" vehicleId={vehicle.id} variant="outline" className="!h-14 !min-h-14 w-full !gap-1 !py-2 !whitespace-normal !border-emerald-500/30 bg-[#11231a] !px-1 !text-xs !tracking-normal hover:!bg-[#183225] [&_svg]:shrink-0 [&_svg]:!h-3.5 [&_svg]:!w-3.5 [&_svg]:text-[#25d366] sm:!text-xs"><span className="min-w-0 text-center">Tenho interesse</span></WhatsAppButton>
                  <Link href={vehiclePath(vehicle)} className="mt-1 flex min-h-11 items-center justify-center text-xs text-cream underline underline-offset-4">Abrir anúncio</Link>
                </td>)}
              </tr>
            </tbody>
          </table>
      </div>
  </>;
}
