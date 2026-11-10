import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/ui";
import { AdminAiHelp } from "@/components/admin/AdminAiHelp";

export default async function AdminHelpPage() {
  if (!(await getSession())) redirect("/admin/login");
  return <div className="space-y-6"><AdminPageHeader title="Ajuda do painel" subtitle="Orientação para usar o painel da Garagem." /><AdminAiHelp /></div>;
}
