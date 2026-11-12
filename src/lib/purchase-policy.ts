/**
 * Política versionada do avaliador de compra (seções 6, 7 e 8 do plano de 10/11/2026).
 *
 * TODOS os números abaixo são PROVISÓRIOS: hipóteses para a loja validar, não médias
 * observadas da Garagem. Mudar valor = nova versão (a revisão salva guarda o snapshot).
 */

export type ScenarioKey = "rapida" | "normal" | "demorada";
export const SCENARIO_KEYS: ScenarioKey[] = ["rapida", "normal", "demorada"];
export const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  rapida: "Rápida",
  normal: "Normal",
  demorada: "Demorada",
};

export type CostStatus = "ok" | "estimado" | "desconhecido" | "nao_se_aplica" | "incluido";
export type CostSource = "orcamento" | "historico" | "premissa";

export type CostItem = {
  key: string;
  label: string;
  status: CostStatus;
  /** Centavos. `ok` usa `baseCents`; `estimado` usa min/base/max; os demais ignoram valores. */
  minCents?: number;
  baseCents?: number;
  maxCents?: number;
  source?: CostSource;
  note?: string;
  /** Quando true, o item vem do perfil provisório e não de orçamento do carro. */
  fromProfile?: boolean;
  date?: string;
  /** Reserva ainda não desembolsada fica fora do retorno sobre capital. */
  upfront?: boolean;
  conditionKey?: "mecanica" | "pneus" | "lataria" | "interior" | "revisao" | "documentacao";
};

export type CeilingPolicy = "meta_em_todos" | "meta_normal_perda_maxima";

export type PurchasePolicy = {
  version: string;
  provisional: true;
  scenarios: Record<ScenarioKey, { days: number; resaleFactor: number }>;
  /** Meta de resultado por negócio, em centavos (M_s, igual nos três cenários). */
  targetCents: number;
  ceilingPolicy: CeilingPolicy;
  /** Só na política `meta_normal_perda_maxima`: substitui a meta adversa por -perdaMaxima. */
  maxLossCents: number;
  /** k_s = monthlyCapitalRate × dias/30 (juros simples). */
  monthlyCapitalRate: number;
  /** q_s: custos proporcionais sobre a venda (comissão/taxas). NÃO é regra fiscal. */
  proportionalRate: number;
  proportionalItems: string[];
  /** Permanência (pátio, seguro, lavagens) por dia em estoque. */
  holdingDailyCents: number;
  /** Folga comercial e passo de oferta do preço ideal. */
  slackCents: number;
  stepCents: number;
  /** Item com status `desconhecido` entra com esta faixa, nunca com zero. */
  unknownCostPlaceholder: { baseCents: number; maxCents: number };
  /** Perfil "preparação leve": base ilustrativa, editável por carro. */
  defaultCostItems: CostItem[];
  score: {
    weights: { financeiro: number; liquidez: number; condicao: number; documentacao: number; completude: number };
    /** Escala positiva usada só se a meta configurada for zero/negativa. */
    scaleTargetCents: number;
    liquidityBands: Array<{ maxDays: number; points: number }>;
    liquidityBeyondPoints: number;
    completeness: { manual: number; spareKey: number; maintenanceHistory: number };
    bands: { forte: number; boa: number; atencao: number };
    /** Cobertura mínima (peso conhecido / peso total) para rótulo favorável. */
    minCoverageForFavorable: number;
  };
  fipeStaleAfterDays: number;
};

// provisorio-2: sem custo de laudo cautelar (a Garagem não faz laudo; o laudo do carro é só informação).
export const PURCHASE_POLICY_VERSION = "2026-11-provisorio-2";

export const DEFAULT_PURCHASE_POLICY: PurchasePolicy = {
  version: PURCHASE_POLICY_VERSION,
  provisional: true,
  scenarios: {
    rapida: { days: 30, resaleFactor: 0.97 },
    normal: { days: 60, resaleFactor: 1 },
    demorada: { days: 90, resaleFactor: 0.94 },
  },
  targetCents: 600_000,
  ceilingPolicy: "meta_em_todos",
  maxLossCents: 0,
  monthlyCapitalRate: 0.01,
  proportionalRate: 0.02,
  proportionalItems: ["Comissão/taxas sobre venda (premissa provisória; taxa configurada na avaliação)"],
  holdingDailyCents: 1_000,
  slackCents: 100_000,
  stepCents: 50_000,
  unknownCostPlaceholder: { baseCents: 30_000, maxCents: 100_000 },
  defaultCostItems: [
    { key: "limpeza", label: "Limpeza/higienização", status: "estimado", minCents: 12_000, baseCents: 18_000, maxCents: 25_000, source: "premissa", fromProfile: true },
    { key: "estetica", label: "Estética leve", status: "estimado", minCents: 15_000, baseCents: 25_000, maxCents: 45_000, source: "premissa", fromProfile: true, note: "Não cobre pintura extensa." },
    { key: "revisao", label: "Revisão básica", status: "estimado", minCents: 30_000, baseCents: 45_000, maxCents: 70_000, source: "premissa", fromProfile: true, note: "Não cobre defeito de motor/câmbio." },
    { key: "ajustes", label: "Pequenos ajustes", status: "estimado", minCents: 5_000, baseCents: 12_000, maxCents: 25_000, source: "premissa", fromProfile: true },
    { key: "contingencia", label: "Contingência da preparação", status: "estimado", minCents: 10_000, baseCents: 20_000, maxCents: 40_000, source: "premissa", fromProfile: true, note: "Separada dos reparos conhecidos." },
    { key: "documentacao", label: "Documentação/transferência", status: "desconhecido", source: "premissa", fromProfile: true },
    { key: "transporte", label: "Transporte", status: "desconhecido", fromProfile: true },
    { key: "pneus", label: "Pneus", status: "desconhecido", fromProfile: true },
    { key: "chave", label: "Chave reserva", status: "desconhecido", fromProfile: true },
    { key: "garantia", label: "Reserva de garantia", status: "estimado", minCents: 20_000, baseCents: 30_000, maxCents: 60_000, source: "premissa", fromProfile: true, upfront: false, note: "Reserva comercial, não garantia jurídica." },
    { key: "fixas", label: "Rateio de despesas fixas (opcional)", status: "desconhecido", fromProfile: true },
  ],
  score: {
    weights: { financeiro: 45, liquidez: 20, condicao: 20, documentacao: 10, completude: 5 },
    scaleTargetCents: 300_000,
    liquidityBands: [
      { maxDays: 30, points: 100 },
      { maxDays: 60, points: 75 },
      { maxDays: 90, points: 45 },
    ],
    liquidityBeyondPoints: 20,
    completeness: { manual: 0.2, spareKey: 0.4, maintenanceHistory: 0.4 },
    bands: { forte: 85, boa: 70, atencao: 50 },
    minCoverageForFavorable: 0.8,
  },
  fipeStaleAfterDays: 40,
};

const isInt = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 2_000_000_000;
const isRate = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1;

/** Política publicada inválida bloqueia o módulo; nunca troca premissas silenciosamente. */
export function parsePurchasePolicy(body: unknown): PurchasePolicy | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const p = body as PurchasePolicy;
  if (typeof p.version !== "string" || !p.version || p.version.length > 100 || p.provisional !== true) return null;
  if (!p.scenarios || !SCENARIO_KEYS.every(k => p.scenarios[k] && isInt(p.scenarios[k].days) && p.scenarios[k].days > 0 && p.scenarios[k].days <= 3650 && Number.isFinite(p.scenarios[k].resaleFactor) && p.scenarios[k].resaleFactor > 0 && p.scenarios[k].resaleFactor <= 2)) return null;
  if (!isInt(p.targetCents) || p.targetCents === 0 || !isInt(p.maxLossCents) || !isRate(p.monthlyCapitalRate) || !isRate(p.proportionalRate)) return null;
  if (![p.holdingDailyCents, p.slackCents, p.stepCents, p.fipeStaleAfterDays].every(isInt) || !p.stepCents) return null;
  if (!p.unknownCostPlaceholder || !isInt(p.unknownCostPlaceholder.baseCents) || !p.unknownCostPlaceholder.baseCents || !isInt(p.unknownCostPlaceholder.maxCents) || p.unknownCostPlaceholder.maxCents < p.unknownCostPlaceholder.baseCents) return null;
  if (!Array.isArray(p.defaultCostItems) || p.defaultCostItems.length > 40 || !p.score || !p.score.weights || !p.score.completeness || !p.score.bands) return null;
  if (!Array.isArray(p.proportionalItems) || p.proportionalItems.some(v => typeof v !== "string" || v.length > 200)) return null;
  const score = p.score;
  if (!["financeiro", "liquidez", "condicao", "documentacao", "completude"].every(k => isInt(score.weights[k as keyof typeof score.weights])) || Object.values(score.weights).reduce((s, n) => s + n, 0) !== 100) return null;
  if (!isInt(score.scaleTargetCents) || !score.scaleTargetCents || !Array.isArray(score.liquidityBands) || !score.liquidityBands.length || score.liquidityBands.length > 10 || score.liquidityBands.some((b, index) => !isInt(b.maxDays) || b.maxDays <= (score.liquidityBands[index - 1]?.maxDays ?? 0) || !isInt(b.points) || b.points > 100)) return null;
  if (!isInt(score.liquidityBeyondPoints) || score.liquidityBeyondPoints > 100 || !Number.isFinite(score.minCoverageForFavorable) || score.minCoverageForFavorable < 0 || score.minCoverageForFavorable > 1) return null;
  if (!["manual", "spareKey", "maintenanceHistory"].every(k => { const v = score.completeness[k as keyof typeof score.completeness]; return Number.isFinite(v) && v >= 0 && v <= 1; }) || Math.abs(Object.values(score.completeness).reduce((s, n) => s + n, 0) - 1) > 1e-8) return null;
  if (![score.bands.forte, score.bands.boa, score.bands.atencao].every(v => isInt(v) && v <= 100) || score.bands.forte < score.bands.boa || score.bands.boa < score.bands.atencao) return null;
  if (p.ceilingPolicy !== "meta_em_todos" && p.ceilingPolicy !== "meta_normal_perda_maxima") return null;
  return p;
}
