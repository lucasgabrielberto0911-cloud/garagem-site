/**
 * Julgamento subjetivo do anúncio via Jev.
 * Uma chamada, várias perguntas. Sem chave ou se a API falhar, devolve null.
 */

import { askJev, type JevQuestion } from "@/lib/jev";
import {
  listingStateText,
  type ListingDraft,
  type ListingFocus,
  type ListingJudgment,
} from "@/lib/listing-present";

export const LISTING_QUESTIONS: Record<string, JevQuestion> = {
  legenda: {
    type: "score",
    instructions:
      "Avalie só a legenda como texto de venda de um seminovo no Brasil. Ignore preço, km, câmbio e combustível: isso já é conferido à parte. Nota baixa se a legenda está vazia, genérica ou só repete a ficha. Nota alta se traz fato concreto de conservação, uso, revisões ou diferencial e dá motivo para chamar no WhatsApp.",
    criteria: [
      "Vazia, genérica ou só repete a ficha",
      "Cita o veículo, mas sem argumento de venda",
      "Concreta: estado ou diferenciais úteis",
      "Convence: detalhes verificáveis e motivo para chamar",
    ],
  },
  opcionais_fracos: {
    type: "noul",
    instructions:
      "A lista de opcionais está pobre para essa versão e esse tipo de veículo? Sim se um comprador sentiria falta de itens comuns dessa versão, ou se a lista está vazia. Não se a lista parece suficiente ou se não há versão para julgar.",
  },
  foco: {
    type: "choice",
    instructions:
      "Entre a legenda e os opcionais, o que o vendedor deve melhorar primeiro para vender mais? Escolha nada se os dois já sustentam a venda.",
    criteria: {
      legenda: "A legenda é o ajuste subjetivo mais importante",
      opcionais: "A lista de opcionais é o ajuste subjetivo mais importante",
      nada: "Legenda e opcionais já estão bons o bastante",
    },
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function parseListingJudgment(
  answers: Record<string, unknown>,
): ListingJudgment | null {
  const caption = asRecord(answers.legenda);
  const score = caption?.score;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  const confidence = caption?.confidence;
  const focusRaw = asRecord(answers.foco)?.choice;
  const focus: ListingFocus =
    focusRaw === "legenda" || focusRaw === "opcionais" || focusRaw === "nada"
      ? focusRaw
      : "nada";
  const thin = asRecord(answers.opcionais_fracos)?.noul;
  return {
    captionScore: clamp(score, 0, 3),
    captionConfidence:
      typeof confidence === "number" && Number.isFinite(confidence)
        ? clamp(confidence, 0, 1)
        : 0.5,
    thinOptions:
      typeof thin === "number" && Number.isFinite(thin) ? clamp(thin, 0, 1) : 0,
    focus,
  };
}

function asText(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** Corpo do POST do admin. Rejeita lixo; ignora placa, cidade e custo. */
export function parseListingDraft(body: unknown): ListingDraft | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const photoCount = raw.photoCount;
  if (
    typeof photoCount !== "number" ||
    !Number.isInteger(photoCount) ||
    photoCount < 0 ||
    photoCount > 80
  ) {
    return null;
  }
  const status = asText(raw.status, 20) || "disponivel";
  if (!["disponivel", "reservado", "vendido"].includes(status)) return null;
  const category = asText(raw.category, 20) === "moto" ? "moto" : "carro";
  const price =
    typeof raw.price === "number" && Number.isFinite(raw.price) ? raw.price : null;
  const accessories = Array.isArray(raw.accessories)
    ? raw.accessories
        .filter((item): item is string => typeof item === "string")
        .slice(0, 40)
        .map((item) => item.slice(0, 80))
    : [];

  return {
    brand: asText(raw.brand, 80),
    model: asText(raw.model, 80),
    version: asText(raw.version, 120),
    year: asText(raw.year, 4),
    yearModel: asText(raw.yearModel, 4),
    km: asText(raw.km, 16),
    transmission: asText(raw.transmission, 40),
    fuel: asText(raw.fuel, 40),
    color: asText(raw.color, 40),
    price,
    description: asText(raw.description, 4_000),
    accessories,
    photoCount,
    status,
    category,
  };
}

type JudgeOptions = {
  fetchImpl?: typeof fetch;
  apiKey?: string | null;
  signal?: AbortSignal;
};

export async function judgeListingQuality(
  draft: ListingDraft,
  options: JudgeOptions = {},
): Promise<ListingJudgment | null> {
  if (draft.status === "vendido") return null;
  if (!draft.brand.trim() || !draft.model.trim()) return null;
  const answers = await askJev(listingStateText(draft), LISTING_QUESTIONS, options);
  if (!answers) return null;
  return parseListingJudgment(answers);
}
