import { redirect } from "next/navigation";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { AdminPageHeader } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { preparationPrefill } from "@/lib/preparation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage({ searchParams }: { searchParams: Promise<{ prep?: string; draft?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const { prep, draft } = await searchParams;
  const item = prep ? await prisma.preparationVehicle.findUnique({ where: { id: prep } }) : null;

  return (
    <div className="space-y-3 sm:space-y-6">
      <AdminPageHeader
        title="Novo veículo"
        subtitle={<>
          Crie o anúncio em quatro etapas: fotos, dados, descrição e revisão.
          <span className="hidden sm:inline"> Confira também os dados internos na revisão antes de publicar.</span>
        </>}
      />
      <VehicleForm
        layout="wizard"
        mode="create"
        adminId={session.adminId}
        prefill={item ? preparationPrefill(item) : undefined}
        preparationId={item?.id}
        draftId={draft}
      />
    </div>
  );
}
