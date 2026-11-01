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

/** FIPE grita FOX/GOL; na vitrine isso é nome de modelo, não sigla. */
const TITLECASE_SHORT_MODELS = new Set(["fox", "gol", "ka"]);

function titleCaseWords(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      // Siglas curtas (BMW, GWM, HR-V partes) — evita "Bmw".
      if (/^[A-Z0-9-]{2,4}$/.test(word) && word === word.toUpperCase()) {
        const folded = word.toLowerCase();
        if (TITLECASE_SHORT_MODELS.has(folded)) {
          return folded.charAt(0).toUpperCase() + folded.slice(1);
        }
        return word;
      }
      // HB20 / HB20S — title case virava "Hb20s".
      if (/^[A-Za-z]{1,3}\d/.test(word.replace(/[^A-Za-z0-9]/g, ""))) {
        return word.toUpperCase();
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

/** Meta description da ficha, sem cortar os dados que identificam o carro. */
export function vehicleSeoDescription(input: {
  brand: string;
  model: string;
  version?: string | null;
  year: number;
  price: number;
  km: number;
  transmission: string;
  sold?: boolean;
  siteName?: string;
}) {
  const label = [formatVehicleLabel(input.brand, input.model), input.version, input.year]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const siteName = input.siteName ?? "Garagem";
  if (input.sold) {
    return `${label} (vendido), seminovo ES na ${siteName}. Veja veículos similares disponíveis e fale pelo WhatsApp.`;
  }
  const price = Number.isFinite(input.price) && input.price > 0
    ? ` por ${formatCurrencyBRL(input.price)}` : "";
  const base = `${label}, seminovo ES${price} na ${siteName}.`;
  const details = ` ${formatNumberBR(input.km)} km, câmbio ${input.transmission}.`;
  const cta = " Confira fotos e fale pelo WhatsApp.";
  return `${base}${base.length + details.length + cta.length <= 160 ? details : ""}${cta}`;
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

export function normalizeBrazilPhoneDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith("55")
  ) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 11);
}

/** Telefone BR com DDD válido (11..99), 10 ou 11 dígitos, sem sequência repetida e celular iniciando com 9. */
export function isValidBrazilPhone(value: string) {
  const digits = normalizeBrazilPhoneDigits(value);
  if (digits.length !== 10 && digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const ddd = Number(digits.slice(0, 2));
  if (!Number.isFinite(ddd) || ddd < 11 || ddd > 99) return false;
  if (digits.length === 11 && digits[2] !== "9") return false;
  if (digits.length === 10 && (digits[2] === "0" || digits[2] === "1")) return false;
  return true;
}

export function formatPhoneBR(value: string) {
  const digits = normalizeBrazilPhoneDigits(value);
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

/** CPF com 11 dígitos, dígitos verificadores corretos e sem sequência repetida. */
export function isValidCpf(value: string) {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const size of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(d[i]) * (size + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[size])) return false;
  }
  return true;
}

/** CPF para listas: só os 6 dígitos do meio aparecem (***.456.789-**). */
export function maskCpf(value: string) {
  const d = value.replace(/\D/g, "");
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "***";
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

/** Final da placa: da placa interna; sem placa, mantém o final já cadastrado. */
export function resolvePlateEnd(plate: string, saved?: string | null) {
  const last = plate.replace(/[^0-9A-Za-z]/g, "").slice(-1);
  return last || saved?.trim() || "";
}

const DAY_MS = 86_400_000;

/** Texto público a partir do createdAt real do anúncio. Aceita Date ou ISO. */
export function formatListedAgo(createdAt: Date | string) {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / DAY_MS),
  );
  if (days <= 0) return "Anunciado hoje";
  if (days === 1) return "Anunciado há 1 dia";
  return `Anunciado há ${days} dias`;
}
