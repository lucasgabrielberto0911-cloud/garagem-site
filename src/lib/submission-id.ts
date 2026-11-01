/** Guarda só o hash e uma chave aleatória na sessão; nenhum campo pessoal. */
export async function submissionId(data: FormData, scope: string) {
  const fields = Array.from(data.entries()).filter(([key]) => key !== "requestId").sort(([a], [b]) => a.localeCompare(b));
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(fields)));
  const hash = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const storageKey = `garagem:envio:${scope}:${hash}`;
  // Se o armazenamento estiver bloqueado, não emite sem proteção contra reenvio.
  const id = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
  sessionStorage.setItem(storageKey, id);
  data.set("requestId", id);
  return () => sessionStorage.removeItem(storageKey);
}
