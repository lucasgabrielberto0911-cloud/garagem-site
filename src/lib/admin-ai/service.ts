import { completeNvidia } from "./nvidia-client";
import { redactPurchaseText } from "./redact";
import * as review from "./revisar-texto";
import * as caption from "./melhorar-legenda";
import * as help from "./ajuda-painel";

export class AdminAiInputError extends Error {}
export function inputText(value: unknown, max = 8000): string {
  if (typeof value !== "string" || value.length > max) throw new AdminAiInputError("Texto ausente ou acima do limite.");
  return value;
}
function privateText(value: unknown, max = 8000) {
  const text = inputText(value, max);
  const safe = redactPurchaseText(text);
  // Evita aplicar offsets da versão anonimizada sobre o texto original.
  if (safe !== text) throw new AdminAiInputError("Remova os dados pessoais do texto antes de pedir a revisão ou melhoria.");
  return safe;
}
export function parseFacts(raw: unknown): caption.CaptionFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AdminAiInputError("Ficha inválida.");
  const facts = raw as Record<string, unknown>;
  const data = facts.data as Record<string, unknown>;
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(facts.accessories) || facts.accessories.length > 60) throw new AdminAiInputError("Ficha inválida.");
  const fields = ["km", "year", "yearModel", "color", "transmission", "fuel", "engine", "price"];
  return {
    brand: privateText(facts.brand, 100), model: privateText(facts.model, 100), version: privateText(facts.version, 150),
    description: privateText(facts.description),
    accessories: facts.accessories.map(item => privateText(item, 100)),
    data: Object.fromEntries(fields.filter(key => data[key] !== undefined).map(key => [key, privateText(data[key], 100)])),
  };
}

export async function runAdminAi(feature: string, body: Record<string, unknown>) {
  if (feature === "revisar-texto") {
    const text = privateText(body.text);
    if (!text.trim()) throw new AdminAiInputError("Digite o texto antes de revisar.");
    const raw = await completeNvidia(review.promptVersion, { text }, review.prompt);
    const suggestions = review.parseReview(raw, text);
    if (suggestions.some(item => redactPurchaseText(item.replacement + "\n" + item.reason) !== item.replacement + "\n" + item.reason)) throw new Error("Resposta inválida.");
    return { suggestions };
  }
  if (feature === "melhorar-legenda") {
    const facts = parseFacts(body.facts);
    const blocks = caption.captionBlocks(facts);
    if (!facts.brand.trim() || !facts.model.trim() || !blocks.length) throw new AdminAiInputError("Preencha marca e modelo para organizar a legenda.");
    const raw = await completeNvidia(caption.promptVersion, { blocks }, caption.prompt);
    try { return { text: caption.parseCaption(raw, blocks) }; }
    catch (error) { throw new AdminAiInputError((error as Error).message); }
  }
  if (feature === "ajuda-painel") {
    const question = redactPurchaseText(inputText(body.question, 1500));
    if (!question.trim()) throw new AdminAiInputError("Digite uma pergunta sobre o painel.");
    return { answer: redactPurchaseText(help.parseHelp(await completeNvidia(help.promptVersion, { question }, help.prompt))) };
  }
  throw new AdminAiInputError("Recurso desconhecido.");
}
