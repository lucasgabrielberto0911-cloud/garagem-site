import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AdminPage() {
  const session = await getSession();

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-asphalt px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 h-1 w-20 bg-brand-gradient" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold italic text-cream">
              Painel Admin
            </h1>
            <p className="mt-2 text-muted">
              Logado como{" "}
              <span className="text-cream">{session.email}</span>
            </p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
