const UNITS = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function below1000(n: number) {
  if (n === 100) return "cem";
  const parts: string[] = [];
  if (n >= 100) parts.push(HUNDREDS[Math.floor(n / 100)]);
  const rest = n % 100;
  if (rest >= 20) parts.push(rest % 10 ? `${TENS[Math.floor(rest / 10)]} e ${UNITS[rest % 10]}` : TENS[rest / 10]);
  else if (rest > 0) parts.push(UNITS[rest]);
  return parts.join(" e ");
}

export function integerWords(n: number) {
  if (n === 0) return "zero";
  const groups = [
    { size: 1_000_000_000, one: "bilhão", many: "bilhões" },
    { size: 1_000_000, one: "milhão", many: "milhões" },
    { size: 1_000, one: "mil", many: "mil" },
  ];
  const parts: string[] = [];
  let rest = n;
  let lastValue = 0; // valor da última parte falada
  for (const group of groups) {
    const count = Math.floor(rest / group.size);
    rest %= group.size;
    if (!count) continue;
    lastValue = count;
    parts.push(group.size === 1_000 && count === 1 ? "mil" : `${below1000(count)} ${count === 1 ? group.one : group.many}`);
  }
  if (rest) { parts.push(below1000(rest)); lastValue = rest; }
  // "e" antes da última parte quando ela é < 100 ou centena exata ("mil e quinhentos", "dois milhões e cem").
  const last = parts.length > 1 ? parts.pop()! : null;
  if (last === null) return parts[0];
  const joinWithE = lastValue < 100 || lastValue % 100 === 0;
  return parts.length && joinWithE ? `${parts.join(", ")} e ${last}` : `${[...parts, last].join(", ")}`;
}

/** Valor em reais por extenso, ex.: 5000 → "cinco mil reais"; 1250.5 → "mil, duzentos e cinquenta reais e cinquenta centavos". */
export function moneyInWords(value: number) {
  const cents = Math.round(Math.abs(value) * 100);
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  const parts: string[] = [];
  if (reais > 0 || centavos === 0) {
    const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? " de" : "";
    parts.push(`${integerWords(reais)}${de} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) parts.push(`${integerWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return parts.join(" e ");
}
