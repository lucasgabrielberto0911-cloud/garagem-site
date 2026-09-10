import {
  CAR_ACCESSORY_PRESETS,
  MOTO_ACCESSORY_PRESETS,
} from "@/lib/vehicle-accessories";
import type { ChatVehicleRecord } from "@/lib/chat-stock";

export const WARRANTY_PHRASE = "garantia de 3 meses de motor e câmbio";

const TRAILING_CONJ =
  /\b(e|ou|mas|de|do|da|dos|das|com|para|pra|por|em|no|na|nos|nas|que|se|um|uma|o|a|os|as|ao|aos)$/i;

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function looksTruncated(
  text: string,
  finishReason?: string | null,
): boolean {
  if (finishReason === "MAX_TOKENS") return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/https?:\/\/\S+$/i.test(trimmed)) return false;
  if (/R\$\s*[\d.]+$/.test(trimmed)) return false;
  if (/\d[\d.]*\s*km$/i.test(trimmed)) return false;
  if (/[.!?]["”']?$/.test(trimmed)) return false;
  if (/[,:;…]$/.test(trimmed)) return true;
  const withoutDots = trimmed.replace(/[.…]+$/, "").trim();
  if (TRAILING_CONJ.test(withoutDots)) return true;
  if (/,\s*[\p{L}]{3,}$/u.test(trimmed)) return true;
  return false;
}

export function trimToLastCompleteSentence(text: string): string {
  const trimmed = text.trim();
  const matches = [...trimmed.matchAll(/[.!?]["”']?(?:\s|$)/g)];
  if (matches.length === 0) return trimmed;
  const last = matches[matches.length - 1]!;
  const end = (last.index ?? 0) + last[0].replace(/\s+$/, "").length;
  const cut = trimmed.slice(0, end).trim();
  return cut || trimmed;
}

export function mergeContinuation(partial: string, extra: string): string {
  const head = partial.trim();
  const tail = extra.trim();
  if (!tail) return head;
  if (!head) return tail;
  if (tail.startsWith(head)) return tail;
  const overlap = Math.min(head.length, tail.length, 80);
  for (let size = overlap; size >= 12; size -= 1) {
    if (head.slice(-size) === tail.slice(0, size)) {
      return `${head}${tail.slice(size)}`.replace(/\s+/g, " ").trim();
    }
  }
  const joiner = /[.!?]$/.test(head) ? " " : " ";
  return `${head}${joiner}${tail}`.replace(/\s+/g, " ").trim();
}

export function polishPortuguese(text: string): string {
  return text
    .replace(/\bpelo loja\b/gi, "pela loja")
    .replace(/\bdo loja\b/gi, "da loja")
    .replace(/\bno loja\b/gi, "na loja")
    .replace(/\bpelo garantia\b/gi, "pela garantia")
    .replace(/\bdo garantia\b/gi, "da garantia")
    .replace(/\bno garantia\b/gi, "na garantia")
    .replace(/\bpelo troca\b/gi, "pela troca")
    .replace(/\bpelo avaliacao\b/gi, "pela avaliação")
    .replace(/\bdo avaliacao\b/gi, "da avaliação")
    .replace(/\bpelo equipe\b/gi, "pela equipe")
    .replace(/\bdo equipe\b/gi, "da equipe")
    .replace(/\bno equipe\b/gi, "na equipe")
    .replace(/\bpelo condicao\b/gi, "pela condição")
    .replace(/\bdo condicao\b/gi, "da condição")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");
}

export function ensureWarrantyCopy(text: string): string {
  if (!/garantia/i.test(text)) return text;
  let next = text.replace(
    /garantia(?: padr[aã]o)? de 3 meses(?!\s+de motor)/gi,
    WARRANTY_PHRASE,
  );
  next = next.replace(
    /3 meses de garantia(?!\s+de motor)/gi,
    WARRANTY_PHRASE,
  );
  if (
    /garantia/i.test(next) &&
    /3 meses/i.test(next) &&
    !/motor e c[aâ]mbio/i.test(next)
  ) {
    next = next.replace(/3 meses/i, "3 meses de motor e câmbio");
  }
  return next;
}

type AccessoryPattern = { key: string; re: RegExp };

function accentFlex(folded: string): string {
  return folded.replace(/[aeiouc ]/g, (char) => {
    if (char === "a") return "[aáàâã]";
    if (char === "e") return "[eéê]";
    if (char === "i") return "[ií]";
    if (char === "o") return "[oóôõ]";
    if (char === "u") return "[uú]";
    if (char === "c") return "[cç]";
    return "[\\s-]+";
  });
}

function accessoryPatterns(): AccessoryPattern[] {
  const names = [...CAR_ACCESSORY_PRESETS, ...MOTO_ACCESSORY_PRESETS];
  const extra = [
    "ar digital",
    "ar condicionado",
    "ar-condicionado",
    "multimidia",
    "central multimídia",
    "direcao eletrica",
    "direcao hidraulica",
    "piloto automatico",
    "vidros eletricos",
    "bancos de couro",
    "teto solar",
    "camera de re",
    "sensor de estacionamento",
  ];
  const seen = new Set<string>();
  const patterns: AccessoryPattern[] = [];
  for (const name of [...extra, ...names]) {
    const key = fold(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    patterns.push({
      key,
      re: new RegExp(`\\b${accentFlex(key)}\\b`, "gi"),
    });
  }
  return patterns;
}

const ACCESSORY_PATTERNS = accessoryPatterns();

function allowedAccessoryKeys(vehicles: ChatVehicleRecord[]): Set<string> {
  const allowed = new Set<string>();
  for (const vehicle of vehicles) {
    for (const item of vehicle.accessories ?? []) {
      const key = fold(item);
      if (key) allowed.add(key);
    }
  }
  return allowed;
}

function accessoryAllowed(key: string, allowed: Set<string>): boolean {
  if (allowed.has(key)) return true;
  for (const item of allowed) {
    if (item === key) return true;
    if (key === "ar condicionado" && item === "arcondicionado") return true;
    if (key === "multimidia" && item.includes("multimidia")) return true;
    if (item === key.replace(/\s/g, "")) return true;
  }
  return false;
}

function tidyAccessoryGaps(text: string): string {
  return text
    .replace(/\s+,/g, ",")
    .replace(/,(?:\s*,)+/g, ",")
    .replace(/\s+e\s+e\s+/gi, " e ")
    .replace(/\btem\s+(?:,|e)\s+/gi, "tem ")
    .replace(/\bcom\s+(?:,|e)\s+/gi, "com ")
    .replace(/\s+e\s+([,.] )/gi, "$1")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function stripInventedAccessories(
  text: string,
  vehicles: ChatVehicleRecord[],
): string {
  if (!text.trim() || vehicles.length === 0) return text;
  const allowed = allowedAccessoryKeys(vehicles);
  if (allowed.size === 0) {
    let next = text;
    for (const item of ACCESSORY_PATTERNS) {
      next = next.replace(item.re, "");
    }
    return tidyAccessoryGaps(next);
  }
  let next = text;
  for (const item of ACCESSORY_PATTERNS) {
    if (!item.re.test(next)) {
      item.re.lastIndex = 0;
      continue;
    }
    item.re.lastIndex = 0;
    if (accessoryAllowed(item.key, allowed)) continue;
    next = next.replace(item.re, "");
  }
  return tidyAccessoryGaps(next);
}

export function closeTruncatedReply(text: string): string {
  const trimmed = trimToLastCompleteSentence(text);
  if (!looksTruncated(trimmed)) return trimmed;
  if (!trimmed) return text.trim();
  if (/[.!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

export function applyChatReplyGuards(
  text: string,
  vehicles: ChatVehicleRecord[] = [],
  opts: { truncated?: boolean } = {},
): string {
  let next = stripInventedAccessories(text, vehicles);
  next = polishPortuguese(next);
  next = ensureWarrantyCopy(next);
  if (opts.truncated || looksTruncated(next)) {
    next = closeTruncatedReply(next);
  }
  return next.trim();
}
