/** Offset estável para cada cidade não repetir o mesmo recorte de 8 carros. */
export function cityShowcaseOffset(slug: string, length: number) {
  if (length <= 0) return 0;
  let hash = 0;
  for (const char of slug) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % length;
}

export function rotateItems<T>(items: T[], offset: number) {
  if (items.length === 0) return items;
  const start = ((offset % items.length) + items.length) % items.length;
  if (start === 0) return items.slice();
  return [...items.slice(start), ...items.slice(0, start)];
}

export function pickCityShowcase<T>(items: T[], slug: string, take: number) {
  if (items.length === 0 || take <= 0) return [];
  const rotated = rotateItems(items, cityShowcaseOffset(slug, items.length));
  return rotated.slice(0, Math.min(take, rotated.length));
}
