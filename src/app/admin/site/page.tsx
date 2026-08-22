import { redirect } from "next/navigation";
import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";
import { AdminPageHeader, Card } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { getSiteContent } from "@/lib/site-content";
import {
  getEditableSiteFields,
  listPlaceholderLabels,
} from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function AdminSitePage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const [fields, content] = await Promise.all([
    getEditableSiteFields(),
    getSiteContent(),
  ]);
  const placeholders = listPlaceholderLabels(fields);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dados do site"
        subtitle="Endereço, horários, foto do Elias, Google, FAQ e condições da ficha — sem editar arquivo."
      />

      {placeholders.length > 0 ? (
        <Card>
          <p className="text-sm leading-relaxed text-muted">
            Ainda faltam preencher:{" "}
            <span className="text-cream">{placeholders.join(", ")}</span>. Enquanto
            houver placeholders, o dashboard continua alertando.
          </p>
        </Card>
      ) : null}

      <SiteSettingsForm initial={fields} content={content} />
    </div>
  );
}
