import { toast } from "sonner";
import { trackPwaEvent } from "@/lib/meta-pixel";
import { enqueueIntent, isLikelyNetworkFailure } from "@/lib/offline-queue";

export async function queueWhatsAppIfOffline(input: {
  url: string;
  label?: string;
  vehicleId?: string;
}) {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  if (!isLikelyNetworkFailure(undefined, online)) return false;
  await enqueueIntent({
    type: "whatsapp",
    url: input.url,
    label: input.label,
    vehicleId: input.vehicleId,
  });
  trackPwaEvent("PwaOfflineQueued", { kind: "whatsapp" });
  toast.success("Sem conexão. Guardamos o recado e abrimos o WhatsApp quando voltar.");
  return true;
}
