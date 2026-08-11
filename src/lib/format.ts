export function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Chave estável para unificar marcas com grafias diferentes (hyundai / Hyundai). */
export function brandKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const BRAND_CANONICAL: Record<string, string> = {
  chevrolet: "Chevrolet",
  ford: "Ford",
  fiat: "Fiat",
  volkswagen: "Volkswagen",
  vw: "Volkswagen",
  hyundai: "Hyundai",
  toyota: "Toyota",
  honda: "Honda",
  jeep: "Jeep",
  mitsubishi: "Mitsubishi",
  renault: "Renault",
  nissan: "Nissan",
  peugeot: "Peugeot",
  citroen: "Citroën",
  kia: "Kia",
  bmw: "BMW",
  "mercedes-benz": "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  audi: "Audi",
  volvo: "Volvo",
  chery: "Chery",
  caoa: "Caoa",
  "caoa chery": "Caoa Chery",
  byd: "BYD",
  gwm: "GWM",
  suzuki: "Suzuki",
  subaru: "Subaru",
  landrover: "Land Rover",
  "land rover": "Land Rover",
  ram: "RAM",
  dodge: "Dodge",
  chrysler: "Chrysler",
  mini: "Mini",
  porsche: "Porsche",
  jaguar: "Jaguar",
  lexus: "Lexus",
  iveco: "Iveco",
  yamaha: "Yamaha",
  kawasaki: "Kawasaki",
  harley: "Harley-Davidson",
  "harley-davidson": "Harley-Davidson",
};

/** Marcas do mapa canônico (para auditoria de valores fora da lista). */
export const KNOWN_BRAND_KEYS = new Set(Object.keys(BRAND_CANONICAL));

function titleCaseWords(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      // Siglas curtas (BMW, GWM, HR-V partes) — evita "Bmw".
      if (/^[A-Z0-9-]{2,4}$/.test(word) && word === word.toUpperCase()) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Normaliza marca para exibição (mapa BR + title case como fallback). */
export function formatBrandName(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  return BRAND_CANONICAL[brandKey(trimmed)] ?? titleCaseWords(trimmed);
}

/** Capitaliza modelo para exibição (sem mapa de marcas). */
export function formatModelName(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  return titleCaseWords(trimmed);
}

/** Ex.: "Hyundai Creta" ou "Hyundai Creta 2022". */
export function formatVehicleLabel(
  brand: string,
  model: string,
  year?: number | null,
) {
  const label = `${formatBrandName(brand)} ${formatModelName(model)}`.trim();
  return year != null ? `${label} ${year}` : label;
}

/**
 * Meta description curta (≈120–155 chars), sem emoji e sem o texto de legenda
 * do anúncio (WhatsApp/redes).
 */
export function vehicleSeoDescription(input: {
  brand: string;
  model: string;
  year: number;
  price: number;
  km: number;
  transmission: string;
  sold?: boolean;
  siteName?: string;
}) {
  const brand = formatBrandName(input.brand);
  const model = formatModelName(input.model);
  const siteName = input.siteName ?? "Garagem";

  const text = input.sold
    ? `Este ${brand} ${model} já foi vendido. Confira outras opções disponíveis no estoque da ${siteName}.`
    : `${brand} ${model} ${input.year} à venda por ${formatCurrencyBRL(input.price)}. ${formatNumberBR(input.km)} km, câmbio ${input.transmission}. Confira fotos e condições de pagamento na ${siteName}.`;

  let clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 120) {
    clean = `${clean.replace(/\.$/, "")}. Atendimento rápido pelo WhatsApp.`;
  }
  if (clean.length <= 155) return clean;
  return `${clean.slice(0, 154).trimEnd()}…`;
}

/** Alt text de foto na ficha: "Marca Modelo Ano - foto N de T". */
export function vehiclePhotoAlt(
  label: string,
  index: number,
  total: number,
) {
  return `${label} - foto ${index + 1} de ${total}`;
}

export function formatNumberBR(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatKmBR(value: number) {
  return `${formatNumberBR(value)} km`;
}

export function formatPhoneBR(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatCpfBR(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Placa só com letras/números em maiúsculas (ex.: ABC1234, ABC1D23). */
export function normalizePlate(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 7);
}

/**
 * Máscara de digitação: formato antigo com hífen (ABC-1234) ou Mercosul
 * sem hífen (ABC1D23), conforme o que o usuário digita.
 */
export function formatPlateInput(value: string) {
  const raw = normalizePlate(value);
  if (raw.length <= 3) return raw;

  const head = raw.slice(0, 3);
  const rest = raw.slice(3);

  // Antigo (só dígitos após as 3 letras): ABC-1234
  if (/^\d*$/.test(rest)) {
    return `${head}-${rest}`;
  }

  // Mercosul: ABC1D23
  return `${head}${rest}`;
}

/** Aceita ABC1234 / ABC-1234 (antigo) ou ABC1D23 (Mercosul). */
export function isValidPlate(value: string) {
  const plate = normalizePlate(value);
  return (
    /^[A-Z]{3}\d{4}$/.test(plate) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(plate)
  );
}

/** Exibição amigável: ABC-1234 (antigo) ou ABC1D23 (Mercosul). */
export function formatPlateDisplay(value: string) {
  const plate = normalizePlate(value);
  if (/^[A-Z]{3}\d{4}$/.test(plate)) {
    return `${plate.slice(0, 3)}-${plate.slice(3)}`;
  }
  return plate;
}
