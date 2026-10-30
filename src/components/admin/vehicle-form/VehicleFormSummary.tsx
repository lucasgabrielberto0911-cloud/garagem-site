import { ListingQualityCard } from "@/components/admin/ListingQualityCard";
import { VehicleFormPreview } from "@/components/admin/VehicleFormPreview";
import { formatCurrencyBRL } from "@/lib/format";
import type { VehicleFormProps } from "./types";
import type { VehicleFormModel } from "./useVehicleFormState";

export function VehicleFormSummary({
  form,
  listingScore,
}: {
  form: VehicleFormModel;
  listingScore?: VehicleFormProps["listingScore"];
}) {
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
    errors,
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

      <VehicleFormPreview
        price={
          listedPrice ? formatCurrencyBRL(listedPrice) : "Preço a preencher"
        }
      >
        <p className="font-display text-lg font-semibold text-cream">
          {`${brand} ${model}`.trim() || "Seu próximo anúncio"}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {[
            version,
            year && yearModel ? `${year}/${yearModel}` : "Ano a preencher",
            values.km ? `${values.km} km` : "KM a preencher",
            transmission,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-2 font-display text-xl font-bold text-red-400">
          {listedPrice ? formatCurrencyBRL(listedPrice) : "Preço a preencher"}
        </p>
        <p className="mt-2 text-xs text-muted">
          {photos.length} foto(s) ·{" "}
          {Object.keys(errors).length
            ? "Corrija os campos destacados antes de publicar."
            : "Confira os dados, a capa e o preço antes de salvar."}
        </p>
      </VehicleFormPreview>
    </div>
  );
}
