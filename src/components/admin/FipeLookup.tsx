"use client";

import { useCallback, useEffect, useState } from "react";
import { Field, btn, inputClass } from "@/components/admin/ui";
import {
  formatCurrencyBRL,
  formatPlateDisplay,
  formatPlateInput,
  isValidPlate,
  normalizePlate,
} from "@/lib/format";
import {
  fipeVehicleTypeFromCategory,
  parseFipePrice,
  type FipeBrand,
  type FipeDetail,
  type FipeModel,
  type FipeYear,
} from "@/lib/fipe";
import type { PlateFipeVersion, PlateLookupResult } from "@/lib/plate-lookup";
import type { VehicleCategory } from "@/lib/vehicle-accessories";

export type FipeApplyPayload = {
  brand?: string;
  model?: string;
  version?: string;
  year?: number | null;
  yearModel?: number | null;
  color?: string;
  fuel?: string;
  fipePrice?: number | null;
  plateEnd?: string | null;
};

type Props = {
  category: VehicleCategory;
  plate: string;
  onPlateChange: (plate: string) => void;
  /** Valor já salvo (edição) — só referência até nova consulta. */
  initialFipePrice?: number | null;
  onApply: (payload: FipeApplyPayload) => void;
};

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data && data.error
        ? String(data.error)
        : "Falha na consulta FIPE.",
    );
  }
  return data;
}

export function FipeLookup({
  category,
  plate,
  onPlateChange,
  initialFipePrice,
  onApply,
}: Props) {
  const vehicleType = fipeVehicleTypeFromCategory(category);

  const [brands, setBrands] = useState<FipeBrand[]>([]);
  const [models, setModels] = useState<FipeModel[]>([]);
  const [years, setYears] = useState<FipeYear[]>([]);

  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [yearId, setYearId] = useState("");

  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingPlate, setLoadingPlate] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [detail, setDetail] = useState<FipeDetail | null>(null);
  const [fipePrice, setFipePrice] = useState<number | null>(
    initialFipePrice ?? null,
  );
  const [plateResult, setPlateResult] = useState<PlateLookupResult | null>(
    null,
  );
  const [selectedVersionId, setSelectedVersionId] = useState("");

  const resetCascade = useCallback(() => {
    setBrandId("");
    setModelId("");
    setYearId("");
    setModels([]);
    setYears([]);
    setDetail(null);
    setStatus(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    resetCascade();
    setFipePrice(initialFipePrice ?? null);
    setLoadingBrands(true);
    setUnavailable(false);

    loadJson<{ brands: FipeBrand[] }>(
      `/api/admin/fipe?resource=brands&vehicleType=${vehicleType}`,
    )
      .then((data) => {
        if (cancelled) return;
        setBrands(data.brands ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setBrands([]);
        setUnavailable(true);
        setStatus(
          "Consulta FIPE indisponível. Preencha marca e modelo manualmente.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingBrands(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleType]);

  useEffect(() => {
    if (!brandId) {
      setModels([]);
      setModelId("");
      setYears([]);
      setYearId("");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoadingModels(true);
    setModelId("");
    setYears([]);
    setYearId("");
    setDetail(null);
    setStatus(null);

    loadJson<{ models: FipeModel[] }>(
      `/api/admin/fipe?resource=models&vehicleType=${vehicleType}&brandId=${encodeURIComponent(brandId)}`,
    )
      .then((data) => {
        if (cancelled) return;
        setModels(data.models ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setModels([]);
        setStatus("Não foi possível carregar os modelos FIPE.");
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });

    return () => {
      cancelled = true;
    };
  }, [brandId, vehicleType]);

  useEffect(() => {
    if (!brandId || !modelId) {
      setYears([]);
      setYearId("");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoadingYears(true);
    setYearId("");
    setDetail(null);
    setStatus(null);

    loadJson<{ years: FipeYear[] }>(
      `/api/admin/fipe?resource=years&vehicleType=${vehicleType}&brandId=${encodeURIComponent(brandId)}&modelId=${encodeURIComponent(modelId)}`,
    )
      .then((data) => {
        if (cancelled) return;
        setYears(data.years ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setYears([]);
        setStatus("Não foi possível carregar os anos FIPE.");
      })
      .finally(() => {
        if (!cancelled) setLoadingYears(false);
      });

    return () => {
      cancelled = true;
    };
  }, [brandId, modelId, vehicleType]);

  useEffect(() => {
    if (!brandId || !modelId || !yearId) return;

    let cancelled = false;
    setLoadingDetail(true);
    setStatus(null);

    loadJson<{ detail: FipeDetail }>(
      `/api/admin/fipe?resource=detail&vehicleType=${vehicleType}&brandId=${encodeURIComponent(brandId)}&modelId=${encodeURIComponent(modelId)}&yearId=${encodeURIComponent(yearId)}`,
    )
      .then((data) => {
        if (cancelled) return;
        const next = data.detail;
        setDetail(next);
        const price = parseFipePrice(next.price);
        setFipePrice(price);
        onApply({
          brand: next.brand?.trim() || "",
          model: next.model?.trim() || "",
          fipePrice: price,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
        setStatus(
          "Não foi possível obter o preço FIPE. Os campos manuais continuam disponíveis.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, modelId, yearId, vehicleType]);

  function applyPlateVersion(
    result: PlateLookupResult,
    version: PlateFipeVersion | null,
  ) {
    const normalized = normalizePlate(result.plate);
    const plateEnd = /\d/.test(normalized.slice(-1))
      ? normalized.slice(-1)
      : null;

    const price = version?.price ?? null;
    setFipePrice(price);
    setDetail(null);

    onApply({
      brand: version?.brand || result.brand || undefined,
      model: version?.model || result.model || undefined,
      version: version?.model || result.version || undefined,
      year: result.year,
      yearModel: version?.modelYear ?? result.yearModel,
      color: result.color || undefined,
      fuel: version?.fuel || result.fuel || undefined,
      fipePrice: price,
      plateEnd,
    });
  }

  async function handlePlateLookup() {
    const normalized = normalizePlate(plate);
    if (!isValidPlate(normalized)) {
      setStatus("Informe uma placa válida (ABC1D23 ou ABC-1234).");
      return;
    }

    setLoadingPlate(true);
    setStatus(null);
    setPlateResult(null);
    setSelectedVersionId("");

    try {
      const data = await loadJson<{ result: PlateLookupResult }>(
        `/api/admin/fipe?resource=plate&plate=${encodeURIComponent(normalized)}&category=${encodeURIComponent(category)}`,
      );
      const result = data.result;
      setPlateResult(result);
      onPlateChange(formatPlateDisplay(result.plate));

      if (result.versions.length === 1) {
        setSelectedVersionId(result.versions[0].id);
        applyPlateVersion(result, result.versions[0]);
        setStatus("Versão FIPE aplicada. Confira e ajuste se precisar.");
      } else if (result.versions.length > 1) {
        setStatus(
          `${result.versions.length} versões FIPE encontradas — escolha a correta.`,
        );
        // Preenche dados básicos da placa sem escolher preço ainda
        applyPlateVersion(result, null);
      } else {
        applyPlateVersion(result, null);
        setStatus(
          "Veículo encontrado, mas sem versões FIPE. Use a busca por marca/modelo/ano.",
        );
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar a placa.",
      );
    } finally {
      setLoadingPlate(false);
    }
  }

  function handleSelectVersion(versionId: string) {
    setSelectedVersionId(versionId);
    if (!plateResult) return;
    const version =
      plateResult.versions.find((item) => item.id === versionId) ?? null;
    applyPlateVersion(plateResult, version);
  }

  const referencePrice = detail
    ? parseFipePrice(detail.price)
    : fipePrice;

  return (
    <div className="mb-4 space-y-4 border border-white/10 bg-ink/40 p-4">
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-wider text-cream">
          Consulta FIPE
        </p>
        <p className="mt-1 text-xs text-muted">
          Uso interno — placa e preço FIPE não aparecem no site. Uma placa pode
          ter várias versões; escolha a correta antes de salvar.
        </p>
      </div>

      <input
        type="hidden"
        name="fipePrice"
        value={fipePrice != null && fipePrice > 0 ? String(fipePrice) : ""}
      />

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field
          label="Placa (interna)"
          hint="Só no admin. O site mostra no máximo o final da placa."
        >
          <input
            name="plate"
            value={plate}
            onChange={(event) =>
              onPlateChange(formatPlateInput(event.target.value))
            }
            placeholder="ABC1D23 ou ABC-1234"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <button
          type="button"
          onClick={handlePlateLookup}
          disabled={loadingPlate || !normalizePlate(plate)}
          className={`${btn.outline} h-[42px] shrink-0`}
        >
          {loadingPlate ? "Consultando…" : "Buscar pela placa"}
        </button>
      </div>

      {plateResult?.versions.length ? (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted">
            Versões FIPE da placa
          </p>
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {plateResult.versions.map((version) => {
              const selected = selectedVersionId === version.id;
              return (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => handleSelectVersion(version.id)}
                  className={`w-full border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-brand bg-brand/10 text-cream"
                      : "border-white/10 bg-ink text-muted hover:border-white/25 hover:text-cream"
                  }`}
                >
                  <span className="block text-sm text-cream">
                    {version.brand ? `${version.brand} · ` : ""}
                    {version.model}
                  </span>
                  <span className="mt-0.5 block text-xs opacity-80">
                    Código {version.codeFipe}
                    {version.modelYear ? ` · ${version.modelYear}` : ""}
                    {version.fuel ? ` · ${version.fuel}` : ""}
                    {version.price != null
                      ? ` · ${formatCurrencyBRL(version.price)}`
                      : ""}
                    {version.score != null ? ` · score ${version.score}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="border-t border-white/10 pt-4">
        <p className="mb-3 text-[11px] uppercase tracking-wider text-muted">
          Ou busque por marca / modelo / ano
        </p>

        {unavailable ? (
          <p className="text-xs text-amber-200/90">{status}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Marca (FIPE)">
              <select
                value={brandId}
                onChange={(event) => setBrandId(event.target.value)}
                disabled={loadingBrands || brands.length === 0}
                className={inputClass}
              >
                <option value="">
                  {loadingBrands ? "Carregando marcas…" : "Selecione a marca"}
                </option>
                {brands.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Modelo (FIPE)">
              <select
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                disabled={!brandId || loadingModels}
                className={inputClass}
              >
                <option value="">
                  {!brandId
                    ? "Escolha a marca antes"
                    : loadingModels
                      ? "Carregando modelos…"
                      : "Selecione o modelo"}
                </option>
                {models.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ano (FIPE)">
              <select
                value={yearId}
                onChange={(event) => setYearId(event.target.value)}
                disabled={!modelId || loadingYears}
                className={inputClass}
              >
                <option value="">
                  {!modelId
                    ? "Escolha o modelo antes"
                    : loadingYears
                      ? "Carregando anos…"
                      : "Selecione o ano"}
                </option>
                {years.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>

      {loadingDetail ? (
        <p className="text-xs text-muted">Buscando preço de referência…</p>
      ) : null}

      {status ? <p className="text-xs text-amber-200/90">{status}</p> : null}

      {detail ? (
        <p className="text-xs text-muted">
          Código FIPE {detail.codeFipe} · {detail.referenceMonth}
          {detail.fuel ? ` · ${detail.fuel}` : ""}
        </p>
      ) : null}

      {referencePrice != null && referencePrice > 0 ? (
        <p className="text-sm text-cream" data-testid="fipe-reference-inline">
          Referência FIPE:{" "}
          <span className="font-semibold text-brand">
            {formatCurrencyBRL(referencePrice)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
