export function redactPurchaseText(value: string): string {
  return value
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "[e-mail removido]")
    .replace(/\b(?:nome(?: do cliente)?|cliente|comprador|vendedor|proprietário|proprietaria|proprietária|contato)\s*[:=]\s*[^\n;,]+/gi, "[nome removido]")
    .replace(/\b(?:[Cc]liente|[Cc]omprador|[Vv]endedor|[Pp]ropriet[áa]ri[oa]|[Nn]ome|[Cc]ontato)\s+[A-ZÀ-Ý][a-zà-ÿ]+(?:\s+(?:(?:da|de|do|dos|das)\s+)?[A-ZÀ-Ý][a-zà-ÿ]+)*/g, "[nome removido]")
    .replace(/\b[A-Z]{3}[-\s]?\d(?:\d{3}|[A-Z]\d{2})\b/gi, "[placa removida]")
    .replace(/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g, "[documento removido]")
    .replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, "[chassi removido]")
    .replace(/(?:\+?55[\s.-]*)?(?:\(\d{2}\)|\b\d{2})[\s.-]*9?\d{4}[\s.-]*\d{4}\b/g, "[telefone removido]")
    .replace(/\b9?\d{4}[-.\s]\d{4}\b/g, "[telefone removido]")
    .replace(/\b(?:renavam|chassi|cpf|telefone|celular|placa)\s*[:=]?\s*[\w.() +\/-]+/gi, "[dado pessoal removido]")
    .replace(/\b\d{8,}\b/g, "[documento removido]");
}
