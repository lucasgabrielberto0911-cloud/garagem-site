/** Não aplica intervalos invertidos nem corrige os valores sem o cliente escolher. */
export function stockRangeError(values: { minPrice: string; maxPrice: string; minYear: string; maxYear: string }) {
  if (values.minPrice && values.maxPrice && Number(values.minPrice) > Number(values.maxPrice)) {
    return "O preço mínimo precisa ser menor ou igual ao máximo.";
  }
  if (values.minYear && values.maxYear && Number(values.minYear) > Number(values.maxYear)) {
    return "O ano mínimo precisa ser menor ou igual ao máximo.";
  }
  return null;
}
