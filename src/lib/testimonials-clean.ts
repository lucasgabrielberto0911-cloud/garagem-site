/**
 * Limpeza e sanitização de dados de depoimentos.
 * Remove menções residuais a "exemplo ilustrativo da loja", "exemplo ilustrativo"
 * e tags HTML de textos vindos do banco de dados ou do código.
 */
export function cleanTestimonialField(value: string | null | undefined): string | null {
  if (!value) return null;

  let text = value
    // Remove tags HTML se houver (ex: <br>, <p>, etc)
    .replace(/<[^>]*>/g, " ")
    // Normaliza quebras de linha e tabs para espaços simples
    .replace(/[\r\n\t]+/g, " ");

  // Remove variações de "exemplo ilustrativo da loja" / "exemplo ilustrativo"
  text = text
    .replace(/\s*[-—–|•/()]*\s*exemplo\s+ilustrativo(\s+da\s+loja)?\s*[-—–|•/()]*\s*/gi, " ")
    .replace(/\s*[-—–|•/()]*\s*ilustrativo(\s+da\s+loja)?\s*[-—–|•/()]*\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Limpa pontuação órfã remanescente no final (ex: "Aracruz, ES -")
  text = text.replace(/[-—–|•/]+$/, "").trim();

  return text || null;
}
