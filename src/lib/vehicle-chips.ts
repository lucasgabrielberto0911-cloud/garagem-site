export type VehicleChipInput = {
  year?: number | null;
  yearModel?: number | null;
  engine?: string | null;
  engineDisplacement?: number | string | null;
  cilindrada?: number | string | null;
  version?: string | null;
  model?: string | null;
  category?: string | null;
};

/**
 * Obtém o ano do modelo formatado para exibição em chip do card.
 */
export function getVehicleYearChip(input: VehicleChipInput): string | null {
  const y = input.yearModel ?? input.year;
  if (typeof y === "number" && Number.isFinite(y) && y >= 1900 && y <= 2100) {
    return String(y);
  }
  return null;
}

/**
 * Obtém a cilindrada ou motorização formatada para exibição em chip do card.
 * Prioriza cilindrada em cc para motos (ex: 300cc, 160cc) e litragem para carros (ex: 2.0).
 */
export function getVehicleDisplacementChip(input: VehicleChipInput): string | null {
  const explicit = input.engineDisplacement ?? input.cilindrada;
  if (explicit != null && explicit !== "") {
    if (typeof explicit === "number" && Number.isFinite(explicit)) {
      if (explicit >= 50) return `${Math.round(explicit)}cc`;
      if (explicit > 0 && explicit < 10) {
        if (input.category === "moto" && explicit <= 1.5) {
          return `${Math.round(explicit * 1000)}cc`;
        }
        return `${explicit.toFixed(1)}`;
      }
    }
    const str = String(explicit).trim();
    if (/^\d{2,4}\s*c\.?c\.?$/i.test(str)) {
      return str.replace(/\s+/g, "").toLowerCase();
    }
    if (/^\d{2,4}$/.test(str)) {
      const n = Number(str);
      if (n >= 50) return `${n}cc`;
    }
    if (/^\d[.,]\d$/.test(str)) {
      return str.replace(",", ".");
    }
  }

  const engine = input.engine?.trim();
  if (engine) {
    const ccMatch = engine.match(/(\d{2,4})\s*c\.?c\.?\b/i);
    if (ccMatch) return `${ccMatch[1]}cc`;

    if (input.category === "moto") {
      const numberMatch = engine.match(
        /\b(50|100|110|125|150|160|190|200|250|300|350|400|500|600|650|750|800|900|1000|1200|1250|1300)\b/
      );
      if (numberMatch) return `${numberMatch[1]}cc`;
    }

    const litersMatch = engine.match(/\b(\d[.,]\d)\b/);
    if (litersMatch) {
      if (input.category === "moto") {
        const val = parseFloat(litersMatch[1].replace(",", "."));
        if (val <= 1.5) return `${Math.round(val * 1000)}cc`;
      }
      return litersMatch[1].replace(",", ".");
    }

    if (engine.length <= 10 && !/flex|gasolina|manual|automatico/i.test(engine)) {
      return engine;
    }
  }

  const text = `${input.model ?? ""} ${input.version ?? ""}`;
  const textCc = text.match(/(\d{2,4})\s*c\.?c\.?\b/i);
  if (textCc) return `${textCc[1]}cc`;

  if (input.category === "moto") {
    const motoCc = text.match(
      /\b(50|100|110|125|150|160|190|200|250|300|350|400|500|600|650|750|800|900|1000|1200|1250|1300)\b/
    );
    if (motoCc) return `${motoCc[1]}cc`;
  }

  const textLiters = text.match(/\b(\d[.,]\d)\b/);
  if (textLiters && input.category !== "moto") {
    return textLiters[1].replace(",", ".");
  }

  return null;
}
