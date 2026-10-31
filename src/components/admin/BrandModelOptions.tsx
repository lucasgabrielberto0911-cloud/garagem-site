import { getAdminBrandModelOptions } from "@/lib/admin-brand-model-options";

export const BRAND_LIST_ID = "admin-brand-options";
export const MODEL_LIST_ID = "admin-model-options";

/** Só `datalist` (sem JS no cliente): o navegador sugere marcas e modelos já cadastrados. */
export async function BrandModelOptions() {
  const { brands, models } = await getAdminBrandModelOptions();
  return (
    <>
      <datalist id={BRAND_LIST_ID}>
        {brands.map((brand) => (
          <option key={brand} value={brand} />
        ))}
      </datalist>
      <datalist id={MODEL_LIST_ID}>
        {models.map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
    </>
  );
}
