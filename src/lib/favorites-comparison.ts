export function comparisonSelection(available: string[], chosen: string[] | null) {
  return [...new Set(chosen ?? available.slice(0, 2))].filter(id => available.includes(id)).slice(0, 3);
}
export function toggleComparison(current: string[], id: string) {
  return current.includes(id) ? current.filter(item => item !== id) : current.length < 3 ? [...current, id] : current;
}
