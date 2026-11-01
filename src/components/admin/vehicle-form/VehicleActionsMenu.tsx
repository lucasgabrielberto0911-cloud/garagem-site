"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteVehicle } from "@/app/admin/veiculos/actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  ActionSheet,
  ActionSheetButton,
  ActionSheetLink,
} from "@/components/admin/ActionSheet";
import { VehiclePromoKitModal } from "@/components/admin/VehiclePromoKitModal";
import {
  IconCash,
  IconExternal,
  IconMore,
  IconTrash,
} from "@/components/admin/icons";
import { vehiclePath } from "@/lib/vehicle-slug";
import {
  DELETE_CONFIRM_PHRASE,
  deleteRequiresTypedConfirm,
} from "@/lib/admin-list";
import type { VehicleFormProps } from "./types";
import type { VehicleFormModel } from "./useVehicleFormState";

export function VehicleActionsMenu({
  form,
  vehicle,
  mode,
}: {
  form: Pick<
    VehicleFormModel,
    "photos" | "accessories" | "pendingAction" | "startTransition"
  >;
  vehicle?: VehicleFormProps["vehicle"];
  mode: VehicleFormProps["mode"];
}) {
  const { photos, accessories, pendingAction, startTransition } = form;
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSold, setConfirmSold] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);

  if (mode !== "edit" || !vehicle) return null;

  function handleDelete() {
    if (!vehicle) return;
    startTransition(async () => {
      try {
        const result = await deleteVehicle(vehicle.id);
        if (result && !result.ok) { toast.error(result.message); return; }
        toast.success("Veículo excluído.");
        router.push("/admin/veiculos");
      } catch {
        toast.error("Erro ao excluir o veículo.");
      }
    });
  }

  function handleMarkSold() {
    if (!vehicle) return;
    const targetId = vehicle.id;
    router.push(`/admin/vendas/nova?veiculo=${targetId}`);
  }

  const modalsOpen = confirmDelete || confirmSold || promoOpen;

  return (
    <>
      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        aria-label="Mais ações do anúncio"
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-white/20 text-cream transition touch-manipulation hover:border-white/40 active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <IconMore className="h-5 w-5" />
      </button>

      <ActionSheet
        open={moreOpen}
        title={`${vehicle.brand} ${vehicle.model}`}
        subtitle="Ações do anúncio"
        onClose={() => setMoreOpen(false)}
      >
        <ActionSheetLink
          href={vehiclePath(vehicle)}
          external
          icon={<IconExternal className="h-4 w-4" />}
          label="Ver no site"
          hint="Abre a página pública em outra aba"
          onNavigate={() => setMoreOpen(false)}
        />
        <ActionSheetButton
          icon={<IconExternal className="h-4 w-4" />}
          label="Kit de divulgação"
          hint="WhatsApp, Instagram e card Status"
          onClick={() => {
            setMoreOpen(false);
            setPromoOpen(true);
          }}
        />
        {vehicle.status !== "vendido" ? (
          <ActionSheetButton
            icon={<IconCash className="h-4 w-4" />}
            label="Iniciar venda"
            hint="O estoque só muda ao concluir o contrato"
            tone="warning"
            disabled={pendingAction}
            onClick={() => {
              setMoreOpen(false);
              setConfirmSold(true);
            }}
          />
        ) : null}
        <ActionSheetLink
          href="/admin/veiculos"
          label="Voltar para a lista"
          hint="Alterações não salvas se perdem"
          onNavigate={() => setMoreOpen(false)}
        />
        <ActionSheetButton
          icon={<IconTrash className="h-4 w-4" />}
          label="Excluir definitivamente"
          hint="Só para duplicata ou erro — a página vira 404"
          tone="danger"
          disabled={pendingAction}
          onClick={() => {
            setMoreOpen(false);
            setConfirmDelete(true);
          }}
        />
      </ActionSheet>

      {modalsOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              onChange={(event) => event.stopPropagation()}
              onSubmit={(event) => event.stopPropagation()}
            >
              <ConfirmDialog
                open={confirmDelete}
                title="Excluir definitivamente"
                description={`Apagar ${vehicle.brand} ${vehicle.model} do banco? A página some (404) e isso prejudica o SEO. Prefira “Marcar como vendido” quando o carro foi vendido. Use exclusão só para cadastro duplicado ou erro.`}
                confirmLabel="Excluir definitivamente"
                danger
                loading={pendingAction}
                typedPhrase={
                  deleteRequiresTypedConfirm({
                    photoCount: photos.length,
                    status: vehicle.status,
                  })
                    ? DELETE_CONFIRM_PHRASE
                    : undefined
                }
                typedLabel="Digite EXCLUIR para confirmar"
                onCancel={() => setConfirmDelete(false)}
                onConfirm={() => {
                  setConfirmDelete(false);
                  handleDelete();
                }}
              />

              <ConfirmDialog
                open={confirmSold}
                title="Iniciar venda"
                description={`Abrir o fluxo de venda de ${vehicle.brand} ${vehicle.model}? O anúncio só será marcado como vendido ao concluir o contrato.`}
                confirmLabel="Iniciar venda"
                danger={false}
                loading={pendingAction}
                onCancel={() => setConfirmSold(false)}
                onConfirm={() => {
                  setConfirmSold(false);
                  handleMarkSold();
                }}
              />

              <VehiclePromoKitModal
                vehicle={{
                  ...vehicle,
                  photos,
                  accessories,
                }}
                open={promoOpen}
                onClose={() => setPromoOpen(false)}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
