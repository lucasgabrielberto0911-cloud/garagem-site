import { redirect } from "next/navigation";
import { TestimonialsManager } from "@/components/admin/TestimonialsManager";
import { AdminPageHeader, StatCard } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DepoimentosPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const items = await prisma.testimonial.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  const published = items.filter((item) => item.published).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Depoimentos"
        subtitle="Os depoimentos publicados aparecem na home. Sem nenhum publicado, a seção mostra o aviso de 'em breve'."
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Cadastrados" value={items.length} />
        <StatCard
          label="Publicados no site"
          value={published}
          tone={published > 0 ? "success" : "warning"}
        />
      </section>

      <TestimonialsManager items={items} />
    </div>
  );
}
