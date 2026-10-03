class CsvMoney {
  constructor(readonly value: number) {}
}

/** Somente valores financeiros calculados no servidor entram como número. */
export function csvMoney(value: number) {
  if (!Number.isFinite(value)) throw new Error("Valor financeiro inválido.");
  return new CsvMoney(value);
}

export function csvCell(value: unknown) {
  if (value instanceof CsvMoney)
    return `"${value.value.toFixed(2).replace(".", ",")}"`;
  let text = String(value ?? "");
  // Planilhas interpretam fórmulas inclusive depois de espaços ou controles.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
export function csvDocument(rows: unknown[][]) {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
