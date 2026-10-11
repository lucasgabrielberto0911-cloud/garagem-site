/**
 * Checagem do anúncio no admin, sem rede.
 * A nota numérica só existe quando o Jev devolve um julgamento.
 * Nada aqui bloqueia salvar ou publicar.
 */

import type { VehicleFormSectionId } from "@/lib/admin-form-sections";
import { transmissionConflictAlert } from "@/lib/vehicle-display";

export type ListingDraft = {
  brand: string;
  model: string;
  version: string;
  year: string;
  yearModel: string;
  km: string;
  transmission: string;
  fuel: string;
  color: string;
  price: number | null;
  description: string;
  accessories: string[];
  photoCount: number;
  status: string;
  category: string;
};

export type ListingReading = ListingDraft & {
  coverWarnings: string[];
};

export type ListingFocus = "legenda" | "opcionais" | "nada";

export type ListingJudgment = {
  /** 0 = fraca, 3 = ótima, na escala de quatro níveis do Jev. */
  captionScore: number;
  captionConfidence: number;
  /** Probabilidade de a lista de opcionais estar pobre para a versão. */
  thinOptions: number;
  focus: ListingFocus;
};

export type ListingGradeLabel = "Fraco" | "Pode melhorar" | "Bom" | "Forte";

export type ListingAdvice = {
  id:
    | "fotos"
    | "capa"
    | "versao"
    | "km"
    | "cambio"
    | "combustivel"
    | "opcionais"
    | "legenda";
  section: VehicleFormSectionId;
  title: string;
  detail: string;
};

export type ListingPresentation = {
  grade: { score: number; label: ListingGradeLabel } | null;
  advice: ListingAdvice[];
  /** Quando não há pendência. */
  clearNote: string | null;
  /** Ainda não dá para medir. */
  prompt: string | null;
};

const CAPTION_WEIGHT = 2.2;
const THIN_OPTIONS = 0.66;
const LOW_CONFIDENCE = 0.4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function gradeLabel(score: number): ListingGradeLabel {
  if (score < 5) return "Fraco";
  if (score < 7) return "Pode melhorar";
  return score < 8.5 ? "Bom" : "Forte";
}

export function listingAccessories(draft: ListingDraft) {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of draft.accessories) {
    const item = raw.trim();
    if (!item) continue;
    const key = item.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

function kmDigits(km: string) {
  return km.replace(/\D/g, "");
}

function photoPenalty(count: number) {
  if (count <= 0) return 3.4;
  if (count < 5) return 2.4;
  if (count < 8) return 1.6;
  return 0;
}

function captionPenalty(draft: ListingDraft, judgment: ListingJudgment) {
  const chars = draft.description.trim().length;
  const score =
    chars < 40
      ? Math.min(clamp(judgment.captionScore, 0, 3), 0.6)
      : clamp(judgment.captionScore, 0, 3);
  const weight =
    judgment.captionConfidence < LOW_CONFIDENCE
      ? CAPTION_WEIGHT * 0.35
      : CAPTION_WEIGHT;
  return ((3 - score) / 3) * weight;
}

/** Quanto cada lacuna tira de uma nota 10. Só entra na nota junto com o Jev. */
export function listingPenalties(
  draft: ListingReading,
  judgment: ListingJudgment,
) {
  const accessories = listingAccessories(draft).length;
  const conflict = Boolean(
    transmissionConflictAlert(draft.version, draft.transmission),
  );
  return {
    photo: photoPenalty(draft.photoCount),
    cover: draft.photoCount > 0 && draft.coverWarnings.length > 0 ? 0.9 : 0,
    version: draft.version.trim() ? 0 : 1.6,
    km: kmDigits(draft.km).length === 0 ? 1.4 : 0,
    transmission: !draft.transmission.trim() || conflict ? 1 : 0,
    fuel: draft.fuel.trim() ? 0 : 1,
    options: accessories === 0 ? 1.1 : accessories < 3 ? 0.5 : 0,
    thin:
      accessories >= 3 && judgment.thinOptions >= THIN_OPTIONS ? 0.7 : 0,
    caption: captionPenalty(draft, judgment),
  };
}

export function listingGrade(
  draft: ListingReading,
  judgment: ListingJudgment,
): { score: number; label: ListingGradeLabel } {
  const total = Object.values(listingPenalties(draft, judgment)).reduce(
    (sum, value) => sum + value,
    0,
  );
  const score = round1(clamp(10 - total, 0, 10));
  return { score, label: gradeLabel(score) };
}

function photoAdvice(count: number): ListingAdvice | null {
  if (count <= 0) {
    return {
      id: "fotos",
      section: "fotos",
      title: "Sem foto de capa",
      detail:
        "O card do estoque precisa de uma frente nítida. A capa é o que faz o comprador parar.",
    };
  }
  const photos = count === 1 ? "1 foto" : `${count} fotos`;
  if (count < 5) {
    return {
      id: "fotos",
      section: "fotos",
      title: "Poucas fotos",
      detail: `Com ${photos} o veículo não aparece por inteiro. Mire em 8: frente, traseira, laterais, interior e painel.`,
    };
  }
  if (count < 8) {
    return {
      id: "fotos",
      section: "fotos",
      title: "Fotos incompletas",
      detail: `Há ${photos}. Falta o que fecha a decisão: interior, painel ou porta-malas.`,
    };
  }
  return null;
}

function captionAdvice(
  draft: ListingDraft,
  judgment: ListingJudgment | null,
): ListingAdvice | null {
  const chars = draft.description.trim().length;
  if (chars < 40) {
    return {
      id: "legenda",
      section: "descricao",
      title: "Legenda curta",
      detail: "Diga conservação, revisões e o que diferencia este veículo.",
    };
  }
  if (
    !judgment ||
    judgment.captionConfidence < LOW_CONFIDENCE ||
    judgment.captionScore >= 2.15
  ) {
    if (!judgment && chars < 140) {
      return {
        id: "legenda",
        section: "descricao",
        title: "Legenda ainda rasa",
        detail:
          "A ficha já está no anúncio. A legenda precisa de um motivo para chamar no WhatsApp.",
      };
    }
    return null;
  }
  if (judgment.captionScore < 1.15) {
    return {
      id: "legenda",
      section: "descricao",
      title: "Legenda não vende",
      detail:
        "Troque o genérico por um fato: estado, uso, revisão ou um item que o outro anúncio não tem.",
    };
  }
  return {
    id: "legenda",
    section: "descricao",
    title: "Legenda ainda rasa",
    detail:
      "A ficha já está no anúncio. A legenda precisa de um motivo para chamar no WhatsApp.",
  };
}

function optionAdvice(
  draft: ListingDraft,
  judgment: ListingJudgment | null,
): ListingAdvice | null {
  const count = listingAccessories(draft).length;
  if (count === 0) {
    return {
      id: "opcionais",
      section: "itens",
      title: "Sem opcionais",
      detail: "Liste ar, direção, multimídia e sensores. É o que o comprador compara.",
    };
  }
  if (count < 3) {
    return {
      id: "opcionais",
      section: "itens",
      title: "Poucos opcionais",
      detail: "Se este veículo tem mais itens, coloque na lista.",
    };
  }
  if (judgment && judgment.thinOptions >= THIN_OPTIONS) {
    return {
      id: "opcionais",
      section: "itens",
      title: "Opcionais curtos para a versão",
      detail:
        "Para essa versão, a lista parece incompleta. Confira ar, direção, sensor e multimídia.",
    };
  }
  return null;
}

function factualAdvice(draft: ListingReading): ListingAdvice[] {
  const advice: ListingAdvice[] = [];
  const photos = photoAdvice(draft.photoCount);
  if (photos) advice.push(photos);
  if (draft.photoCount > 0 && draft.coverWarnings.length > 0) {
    advice.push({
      id: "capa",
      section: "fotos",
      title: "Capa fraca",
      detail: draft.coverWarnings[0] ?? "",
    });
  }
  if (!draft.version.trim()) {
    advice.push({
      id: "versao",
      section: "identificacao",
      title: "Falta a versão",
      detail:
        "A pessoa busca pelo motor, pela versão ou pelo pacote. Sem isso o anúncio perde a comparação.",
    });
  }
  if (kmDigits(draft.km).length === 0) {
    advice.push({
      id: "km",
      section: "ficha",
      title: "Falta a quilometragem",
      detail: "Sem km o anúncio perde confiança na hora.",
    });
  }
  const conflict = transmissionConflictAlert(draft.version, draft.transmission);
  if (!draft.transmission.trim()) {
    advice.push({
      id: "cambio",
      section: "ficha",
      title: "Falta o câmbio",
      detail: "Manual ou automático é filtro de compra.",
    });
  } else if (conflict) {
    advice.push({
      id: "cambio",
      section: "ficha",
      title: "Câmbio não bate com a versão",
      detail: conflict,
    });
  }
  if (!draft.fuel.trim()) {
    advice.push({
      id: "combustivel",
      section: "ficha",
      title: "Falta o combustível",
      detail: "Flex, gasolina ou diesel. Sem isso a ficha fica pela metade.",
    });
  }
  return advice;
}

const SUBJECTIVE = new Set<ListingAdvice["id"]>(["opcionais", "legenda"]);

function orderAdvice(
  items: ListingAdvice[],
  focus: ListingFocus | null,
): ListingAdvice[] {
  if (focus !== "legenda" && focus !== "opcionais") return items;
  if (items.some((item) => !SUBJECTIVE.has(item.id))) return items;
  return items.slice().sort((a, b) => {
    if (a.id === focus) return -1;
    if (b.id === focus) return 1;
    return 0;
  });
}

export function presentListing(
  draft: ListingReading,
  judgment: ListingJudgment | null,
): ListingPresentation {
  if (draft.status === "vendido") {
    return { grade: null, advice: [], clearNote: null, prompt: null };
  }
  if (!draft.brand.trim() || !draft.model.trim()) {
    return {
      grade: null,
      advice: [],
      clearNote: null,
      prompt: "Preencha marca e modelo para medir o anúncio.",
    };
  }

  const advice = orderAdvice(
    [
      ...factualAdvice(draft),
      optionAdvice(draft, judgment),
      captionAdvice(draft, judgment),
    ].filter((item): item is ListingAdvice => item !== null),
    judgment?.focus ?? null,
  );

  return {
    grade: judgment ? listingGrade(draft, judgment) : null,
    advice,
    clearNote:
      advice.length === 0
        ? judgment
          ? "Pode publicar. Capa, fotos e texto sustentam a venda."
          : "Nada importante faltando na ficha, nas fotos ou na legenda."
        : null,
    prompt: null,
  };
}

export function isListingJudgment(value: unknown): value is ListingJudgment {
  if (!value || typeof value !== "object") return false;
  const raw = value as Partial<ListingJudgment>;
  return (
    typeof raw.captionScore === "number" &&
    Number.isFinite(raw.captionScore) &&
    typeof raw.captionConfidence === "number" &&
    Number.isFinite(raw.captionConfidence) &&
    typeof raw.thinOptions === "number" &&
    Number.isFinite(raw.thinOptions) &&
    (raw.focus === "legenda" ||
      raw.focus === "opcionais" ||
      raw.focus === "nada")
  );
}

/** Texto de contexto para o Jev. Sem placa, cidade, custo ou documento. */
export function listingStateText(draft: ListingDraft) {
  const accessories = listingAccessories(draft).slice(0, 30);
  const description = draft.description.trim().slice(0, 1200);
  const year = [draft.year.trim(), draft.yearModel.trim()]
    .filter(Boolean)
    .join("/");
  const digits = kmDigits(draft.km);
  const km = digits
    ? `${Number(digits).toLocaleString("pt-BR")} km`
    : "não informada";
  const price =
    draft.price != null && Number.isFinite(draft.price) && draft.price > 0
      ? draft.price.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })
      : "não informado";
  const title = [draft.brand, draft.model, draft.version]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

  return [
    "Anúncio de seminovo da loja Garagem, para o site público.",
    `Tipo: ${draft.category === "moto" ? "moto" : "carro"}`,
    `Veículo: ${title}`,
    `Ano: ${year || "não informado"}`,
    `Quilometragem: ${km}`,
    `Câmbio: ${draft.transmission.trim() || "não informado"}`,
    `Combustível: ${draft.fuel.trim() || "não informado"}`,
    `Cor: ${draft.color.trim() || "não informada"}`,
    `Preço anunciado: ${price}`,
    `Opcionais: ${accessories.length ? accessories.join(", ") : "nenhum"}`,
    "Legenda do anúncio:",
    description || "(vazia)",
  ].join("\n");
}
