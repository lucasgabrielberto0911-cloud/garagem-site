import { redirect } from "next/navigation";
import { BrandModelOptions } from "@/components/admin/BrandModelOptions";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { AdminPageHeader } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { preparationPrefill } from "@/lib/preparation";
import { prisma } from "@/lib/prisma";
import { vehicleDraftParam } from "@/lib/vehicle-draft-fields";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ prep?: string; draft?: string | string[]; dup?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const { prep, draft, dup } = await searchParams;
  const isDuplicate = dup === "1" || dup === "true";
  const item = prep
    ? await prisma.preparationVehicle.findUnique({ where: { id: prep } })
    : null;

  return (
    <div className="space-y-3 sm:space-y-6">
      <AdminPageHeader
        title="Novo veículo"
        subtitle={<>
          Crie o anúncio em quatro etapas: fotos, dados, preço e revisão.
        </>}
      />
      <VehicleForm
        layout="wizard"
        mode="create"
        adminId={session.adminId}
        prefill={item ? preparationPrefill(item) : undefined}
        preparationId={item?.id}
        draftId={vehicleDraftParam(draft)}
        autoRestoreDraft={isDuplicate}
      />
      <BrandModelOptions />
    </div>
  );
}
