/**
 * Faixa típica de catálogo (cidade, conservadora). Nunca é medição do usado
 * na loja — o texto deixa isso explícito para o modelo copiar, não inventar.
 */

export type ConsumptionVehicle = {
  fuel: string;
  engine?: string | null;
  version?: string | null;
  category?: string | null;
};

export type ConsumptionRange = {
  label: string;
  city: string;
  /** Trecho curto pra lista: "11–14 km/l". */
  kmL: string;
};

/** Cilindrada em litros: "1.0", "2.0 TSI", "160cc", moto "BIZ 125". */
export function parseEngineDisplacementLiters(
  engine: string | null | undefined,
  version: string | null | undefined,
  category?: string | null,
): number | null {
  const blob = `${engine ?? ""} ${version ?? ""}`;
  const cc = blob.match(/(\d{2,4})\s*c\.?c\.?\b/i);
  if (cc) {
    const n = Number(cc[1]);
    if (n >= 50 && n <= 2000) return n / 1000;
  }
  const liters = blob.match(/\b(\d)[.,](\d)\b/);
  if (liters) return Number(`${liters[1]}.${liters[2]}`);
  if ((category ?? "carro") === "moto") {
    const naked = blob.match(
      /\b(50|100|110|125|150|160|200|250|300|400|500|600|650|750|1000)\b/,
    );
    if (naked) return Number(naked[1]) / 1000;
  }
  return null;
}

function isDiesel(fuel: string) {
  return /diesel/.test(fuel.toLowerCase());
}

function isHybrid(fuel: string) {
  return /h[ií]brid/.test(fuel.toLowerCase());
}

function isElectric(fuel: string) {
  return /el[eé]tr/.test(fuel.toLowerCase());
}

export function typicalConsumptionRange(
  vehicle: ConsumptionVehicle,
): ConsumptionRange | null {
  const fuel = vehicle.fuel || "";
  const category = vehicle.category ?? "carro";
  const liters = parseEngineDisplacementLiters(
    vehicle.engine,
    vehicle.version,
    category,
  );

  if (category === "moto") {
    const cc = liters != null ? Math.round(liters * 1000) : null;
    if (cc != null && cc <= 125) {
      return {
        label: `${cc}cc`,
        city: "35–45 km/l cidade",
        kmL: "35–45 km/l",
      };
    }
    if (cc != null && cc <= 160) {
      return {
        label: `${cc}cc`,
        city: "30–40 km/l cidade",
        kmL: "30–40 km/l",
      };
    }
    if (cc != null) {
      return {
        label: `${cc}cc`,
        city: "20–32 km/l cidade",
        kmL: "20–32 km/l",
      };
    }
    return {
      label: "moto leve",
      city: "bem menos que um carro 1.0",
      kmL: "bem menos que um 1.0",
    };
  }

  if (isElectric(fuel)) {
    return {
      label: "elétrico",
      city: "sem km/l (autonomia da bateria)",
      kmL: "sem km/l",
    };
  }
  if (isHybrid(fuel)) {
    return {
      label: "híbrido",
      city: "15–22 km/l cidade",
      kmL: "15–22 km/l",
    };
  }

  if (liters != null && isDiesel(fuel)) {
    if (liters <= 1.6) {
      return {
        label: `diesel ${liters.toFixed(1)}`,
        city: "9–12 km/l cidade / 12–16 km/l estrada",
        kmL: "9–12 km/l cidade",
      };
    }
    return {
      label: `diesel ${liters.toFixed(1)}`,
      city: "8–11 km/l cidade / 10–14 km/l estrada",
      kmL: "8–11 km/l cidade",
    };
  }

  if (liters != null) {
    if (liters <= 1.0) {
      return {
        label: "1.0 flex",
        city: "11–14 km/l cidade (gasolina)",
        kmL: "11–14 km/l",
      };
    }
    if (liters <= 1.4) {
      return {
        label: `${liters.toFixed(1)} flex`,
        city: "10–13 km/l cidade (gasolina)",
        kmL: "10–13 km/l",
      };
    }
    if (liters <= 1.6) {
      return {
        label: `${liters.toFixed(1)} flex`,
        city: "9–12 km/l cidade (gasolina)",
        kmL: "9–12 km/l",
      };
    }
    if (liters <= 2.0) {
      return {
        label: `${liters.toFixed(1)}`,
        city: "8–11 km/l cidade (gasolina)",
        kmL: "8–11 km/l",
      };
    }
    return {
      label: `${liters.toFixed(1)}`,
      city: "7–10 km/l cidade (gasolina)",
      kmL: "7–10 km/l",
    };
  }

  if (isDiesel(fuel)) {
    return {
      label: "diesel",
      city: "em geral mais km/l que um flex equivalente",
      kmL: "mais km/l que um flex",
    };
  }
  return null;
}

/** Uma linha pra injetar no estoque do prompt — o modelo copia, não inventa. */
export function typicalConsumptionHint(vehicle: ConsumptionVehicle) {
  const range = typicalConsumptionRange(vehicle);
  if (!range) {
    return "consumo: 1.0 flex costuma gastar menos que 1.8/2.0; este usado não foi medido na loja";
  }
  if (range.label === "elétrico") {
    return `elétrico: ${range.city}; este usado não foi medido na loja`;
  }
  return `${range.label}: faixa típica de catálogo ~${range.city}; este usado não foi medido na loja`;
}
