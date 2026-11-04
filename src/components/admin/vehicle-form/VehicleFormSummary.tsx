"use client";

import { ListingQualityCard } from "@/components/admin/ListingQualityCard";
import { useState } from "react";
import { ListingPreview } from "@/components/admin/ListingPreview";
import { parseVehicleKm } from "@/lib/admin-vehicle-fields";
import type { VehicleFormProps } from "./types";
import type { VehicleFormModel } from "./useVehicleFormState";

export function VehicleFormSummary({
  form,
  listingScore,
}: {
  form: VehicleFormModel;
  listingScore?: VehicleFormProps["listingScore"];
}) {
  const [showPreview, setShowPreview] = useState(false);
  const {
    step,
    brand,
    model,
    version,
    year,
    yearModel,
    values,
    transmission,
    fuel,
    color,
    listedPrice,
    description,
    accessories,
    photos,
    status,
    category,
    dirty,
    saving,
    revealSections,
  } = form;
  return (
    <div className={step !== 4 ? "hidden" : "space-y-4"}>
      <ListingQualityCard
        draft={{
          brand,
          model,
          version,
          year,
          yearModel,
          km: values.km,
          transmission,
          fuel,
          color,
          price: listedPrice > 0 ? listedPrice : null,
          description,
          accessories,
          photoCount: photos.length,
          status,
          category,
        }}
        coverUrl={photos[0]?.url ?? ""}
        judgment={listingScore?.judgment ?? null}
        scoredAt={listingScore?.scoredAt ?? null}
        dirty={dirty}
        saving={saving}
        onJump={(section) => revealSections([section])}
      />

      <div className="space-y-3">
        <button
          type="button"
          aria-expanded={showPreview}
          aria-controls="listing-preview-panel"
          onClick={() => setShowPreview((open) => !open)}
          className="min-h-11 border border-white/20 px-3 py-2 font-display text-sm text-cream transition hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {showPreview ? "Esconder prévia" : "Ver como fica no site"}
        </button>
        {showPreview ? (
          <div id="listing-preview-panel">
            <ListingPreview
              brand={brand}
              model={model}
              version={version}
              yearModel={Number(yearModel) || null}
              km={parseVehicleKm(values.km)}
              transmission={transmission}
              price={listedPrice > 0 ? listedPrice : null}
              status={status}
              coverUrl={photos[0]?.url ?? ""}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
