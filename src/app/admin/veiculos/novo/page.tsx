import { VehicleForm } from "@/components/admin/VehicleForm";

export default function NewVehiclePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="mb-2 h-1 w-16 bg-brand-gradient" aria-hidden="true" />
        <h1 className="font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
          Novo veículo
        </h1>
        <p className="mt-1 text-sm text-muted">
          Preencha os dados e envie as fotos do estoque.
        </p>
      </div>
      <VehicleForm mode="create" />
    </div>
  );
}
