import Link from "next/link";
import { btn } from "@/components/admin/ui";

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center border border-dashed border-white/15 px-6 py-16 text-center">
      <div className="h-1 w-16 bg-brand-gradient" aria-hidden="true" />
      <h1 className="mt-5 font-display text-2xl font-bold text-cream">
        Registro não encontrado
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
        O item que você tentou abrir pode ter sido excluído por outra pessoa.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/admin/veiculos" className={btn.primary}>
          Ver veículos
        </Link>
        <Link href="/admin" className={btn.outline}>
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  );
}
