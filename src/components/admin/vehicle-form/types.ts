import type { Photo, Vehicle } from "@prisma/client";
import type { StoredListingScore } from "@/lib/listing-score";

export type VehicleWithPhotos = Vehicle & { photos: Photo[] };
export type VehicleFormProps = {
  vehicle?: VehicleWithPhotos;
  /** Dados de um carro Em preparação para pré-preencher o cadastro novo. */
  prefill?: Partial<VehicleWithPhotos>;
  preparationId?: string;
  draftId?: string;
  mode: "create" | "edit";
  adminId: string;
  /** Nota gravada no último Salvar. O formulário nunca chama o Jev. */
  listingScore?: StoredListingScore | null;
  initialTab?: "anuncio" | "fotos";
  layout?: "wizard";
  autoRestoreDraft?: boolean;
};
export const STATUSES = [
  { value: "disponivel", label: "Disponível" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
];
export const errorBorder = "border-brand/60";
export const SEGMENT =
  "flex min-h-[44px] flex-1 flex-col items-center justify-center border px-3 py-2 text-center transition touch-manipulation";
export const SEGMENT_ON = "border-brand bg-brand/10 text-cream";
export const SEGMENT_OFF =
  "border-white/10 bg-ink text-muted hover:border-white/25 hover:text-cream";
