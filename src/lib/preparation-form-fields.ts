/** Checkbox desmarcado não vai no FormData: com `fields` devolvidos, ausência = false. */
export function checkedFieldValue(
  fields: Record<string, string> | undefined,
  key: string,
  fallback?: boolean,
) {
  if (fields) return fields[key] === "on";
  return fallback ?? false;
}
