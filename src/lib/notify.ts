import type { ExternalToast } from "sonner";

/** O toaster público escuta isto e só então baixa o sonner. */
export const TOAST_EVENT = "garagem:toast";

type ToastKind = "success" | "error" | "message";

let pending = false;
let ready = false;
let onRequest: (() => void) | null = null;
const waiters: Array<() => void> = [];

export function subscribeToasterRequest(handler: () => void) {
  onRequest = handler;
  if (pending) handler();
  return () => {
    if (onRequest === handler) onRequest = null;
  };
}

export function signalToasterReady() {
  ready = true;
  const list = waiters.splice(0);
  for (const waiter of list) waiter();
}

function ensureToaster() {
  if (typeof window === "undefined" || ready) return Promise.resolve();
  pending = true;
  onRequest?.();
  return new Promise<void>((resolve) => {
    if (ready) resolve();
    else waiters.push(resolve);
  });
}

async function show(kind: ToastKind, message: string, options?: ExternalToast) {
  await ensureToaster();
  const { toast } = await import("sonner");
  if (kind === "success") toast.success(message, options);
  else if (kind === "error") toast.error(message, options);
  else toast(message, options);
}

export function notifySuccess(message: string, options?: ExternalToast) {
  void show("success", message, options);
}

export function notifyError(message: string, options?: ExternalToast) {
  void show("error", message, options);
}

export function notify(message: string, options?: ExternalToast) {
  void show("message", message, options);
}
