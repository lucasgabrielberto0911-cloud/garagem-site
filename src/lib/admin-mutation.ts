import { toast } from "sonner";
export async function adminMutation<
  T extends {
    ok?: boolean;
    success?: boolean;
    message?: string;
    error?: string;
  },
>(run: () => Promise<T>): Promise<T> {
  try {
    const response = await fetch("/api/admin/session", { cache: "no-store" });
    if (!response.ok) {
      const message =
        "Sessão indisponível. Seus campos continuam aqui. Entre novamente em outra aba e tente salvar.";
      toast.error(message, {
        duration: 12000,
        action: {
          label: "Entrar",
          onClick: () => window.open("/admin/login", "_blank", "noopener"),
        },
      });
      return { ok: false, error: message, message } as T;
    }
    return await run();
  } catch {
    const message =
      "Não foi possível salvar. Seus campos continuam aqui. Confira a conexão e tente novamente.";
    return { ok: false, error: message, message } as T;
  }
}
