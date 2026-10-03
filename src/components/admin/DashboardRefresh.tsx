"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { refreshDashboard } from "@/app/admin/dashboard-actions";
import { btn } from "@/components/admin/ui";
export function DashboardRefresh() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={btn.outline}
      onClick={() =>
        start(async () => {
          try {
            const result = await refreshDashboard();
            if (result.ok) router.refresh();
            else toast.error(result.message);
          } catch {
            toast.error("Não foi possível atualizar. Tente novamente.");
          }
        })
      }
    >
      {pending ? "Atualizando…" : "Atualizar dados"}
    </button>
  );
}
