/**
 * Quando calcular a nota do anúncio pelo Jev.
 *
 * Regra: o Jev só é chamado no Salvar do admin, e só se o texto que ele avalia
 * mudou. Abrir o admin, editar campos ou salvar sem mudança não chama o Jev.
 * Se o Jev falhar, o veículo já está salvo; só a nota não é atualizada.
 *
 * Sem Prisma aqui: o acesso ao banco entra por `deps` (ver listing-score-store).
 */

import { createHash } from "node:crypto";
import {
  isListingJudgment,
  listingStateText,
  type ListingDraft,
  type ListingJudgment,
} from "@/lib/listing-present";

/** Campos do veículo que entram na nota. */
export type ListingScoreSource = {
  brand: string;
  model: string;
  version: string | null;
  year: number | string;
  yearModel: number | string;
  km: number | string;
  transmission: string;
  fuel: string;
  color: string | null;
  price: number | null;
  description: string | null;
  accessories: string[];
  status: string;
  category: string;
};

export function listingDraftFromVehicle(
  vehicle: ListingScoreSource,
  photoCount: number,
): ListingDraft {
  return {
    brand: vehicle.brand ?? "",
    model: vehicle.model ?? "",
    version: vehicle.version ?? "",
    year: String(vehicle.year ?? ""),
    yearModel: String(vehicle.yearModel ?? ""),
    km: String(vehicle.km ?? ""),
    transmission: vehicle.transmission ?? "",
    fuel: vehicle.fuel ?? "",
    color: vehicle.color ?? "",
    price:
      typeof vehicle.price === "number" && vehicle.price > 0
        ? vehicle.price
        : null,
    description: vehicle.description ?? "",
    accessories: vehicle.accessories ?? [],
    photoCount,
    status: vehicle.status,
    category: vehicle.category,
  };
}

/** Assinatura do que o Jev lê. Mesmo texto, mesma nota: não chama de novo. */
export function listingInputHash(draft: ListingDraft) {
  return createHash("sha256").update(listingStateText(draft)).digest("hex");
}

export function scorable(draft: ListingDraft) {
  return (
    draft.status !== "vendido" &&
    Boolean(draft.brand.trim()) &&
    Boolean(draft.model.trim())
  );
}

/**
 * Decide se o Salvar chama o Jev.
 * `before` null = anúncio novo (criar conta como alteração).
 */
export function shouldScoreOnSave(input: {
  before: ListingDraft | null;
  after: ListingDraft;
  storedHash: string | null;
}) {
  if (!scorable(input.after)) return false;
  const next = listingInputHash(input.after);
  if (input.storedHash === next) return false;
  if (input.before && listingInputHash(input.before) === next) return false;
  return true;
}

export type StoredListingScore = {
  judgment: ListingJudgment;
  inputHash: string;
  scoredAt: string;
};

export type ListingScoreDeps = {
  /** Nota gravada. Lança se o banco falhar. */
  load: (vehicleId: string) => Promise<{ inputHash: string } | null>;
  save: (
    vehicleId: string,
    judgment: ListingJudgment,
    inputHash: string,
  ) => Promise<void>;
  judge: (draft: ListingDraft) => Promise<ListingJudgment | null>;
  log?: Pick<Console, "info" | "warn">;
};

export type ListingScoreOutcome =
  | "sem-mudanca"
  | "nao-avaliavel"
  | "calculada"
  | "jev-falhou"
  | "erro";

/**
 * Chamado depois que o veículo já foi salvo. Nunca lança: o Salvar segue
 * igual mesmo com Jev ou tabela fora.
 */
export async function refreshListingScoreOnSave(
  input: {
    vehicleId: string;
    before: ListingDraft | null;
    after: ListingDraft;
  },
  deps: ListingScoreDeps,
): Promise<ListingScoreOutcome> {
  const log = deps.log ?? console;
  try {
    if (!scorable(input.after)) return "nao-avaliavel";
    // Sem mudança no que o Jev lê: nem consulta o banco.
    if (
      input.before &&
      listingInputHash(input.before) === listingInputHash(input.after)
    ) {
      log.info("[nota-anuncio] salvar sem mudança: Jev não chamado");
      return "sem-mudanca";
    }
    const stored = await deps.load(input.vehicleId);
    if (
      !shouldScoreOnSave({
        before: input.before,
        after: input.after,
        storedHash: stored?.inputHash ?? null,
      })
    ) {
      log.info("[nota-anuncio] texto já avaliado: Jev não chamado");
      return "sem-mudanca";
    }
    log.info("[nota-anuncio] salvar com mudança: chamando Jev");
    const judgment = await deps.judge(input.after);
    if (!judgment || !isListingJudgment(judgment)) {
      log.warn("[nota-anuncio] Jev sem resposta: nota mantida");
      return "jev-falhou";
    }
    await deps.save(input.vehicleId, judgment, listingInputHash(input.after));
    return "calculada";
  } catch (error) {
    log.warn(
      "[nota-anuncio] falha ao gravar a nota:",
      error instanceof Error ? error.name : "erro",
    );
    return "erro";
  }
}

export function parseStoredListingScore(
  row: { judgment: unknown; inputHash: string; updatedAt: Date } | null,
): StoredListingScore | null {
  if (!row || !isListingJudgment(row.judgment)) return null;
  return {
    judgment: row.judgment,
    inputHash: row.inputHash,
    scoredAt: row.updatedAt.toISOString(),
  };
}
