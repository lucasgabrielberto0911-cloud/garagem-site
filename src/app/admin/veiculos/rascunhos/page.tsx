import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/ui";
import { VehicleDraftList } from "@/components/admin/VehicleDraftList";

export default async function VehicleDraftsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Rascunhos"
        subtitle="Cadastros privados que ainda não foram publicados."
      />
      <VehicleDraftList adminId={session.adminId} />
    </div>
  );
}
