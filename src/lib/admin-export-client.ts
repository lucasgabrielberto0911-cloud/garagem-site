import { toast } from "sonner";
export async function exportAdminCsv(url: string, filename: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error || "A exportação falhou. Nenhum CSV parcial foi baixado.",
    );
  }
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  toast.success(
    `${response.headers.get("X-Record-Count") || "Todos os"} registros exportados.`,
  );
}
