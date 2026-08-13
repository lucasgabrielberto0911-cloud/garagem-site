import { redirect } from "next/navigation";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { AdminPageHeader } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Novo veículo"
        subtitle="Preencha o anúncio e as fotos. Custos e documentos ficam na aba Operação depois de salvar."
      />
      <VehicleForm mode="create" />
    </div>
  );
}
