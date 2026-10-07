export type SharePlatform = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

export function canonicalVehicleShareUrl(origin: string, path: string) {
  const url = new URL(path, origin);
  if (url.origin !== new URL(origin).origin || !url.pathname.startsWith("/estoque/")) {
    throw new Error("Link inválido de anúncio");
  }
  return url.href;
}

/** Cancelar a janela do sistema não é uma falha nem copia sem o cliente pedir. */
export async function shareVehicleLink(platform: SharePlatform, data: ShareData): Promise<"shared" | "copied" | "cancelled"> {
  if (platform.share && (!platform.canShare || platform.canShare(data))) {
    try {
      await platform.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
      throw error;
    }
  }
  if (!platform.clipboard || !data.url) throw new Error("Compartilhamento indisponível");
  await platform.clipboard.writeText(data.url);
  return "copied";
}
