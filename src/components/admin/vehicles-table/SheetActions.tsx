"use client";

import { ActionSheetButton, ActionSheetLink } from "@/components/admin/ActionSheet";
import { IconCash, IconCheck, IconClipboard, IconCopy, IconExternal, IconPencil, IconStar, IconTrash } from "@/components/admin/icons";
import { ADMIN_CARD_OVERFLOW_ACTIONS, adminCardOverflowStatuses, adminCardShowsSoldAction, type AdminCardOverflowAction } from "@/lib/admin-list";
import { MAX_HOME_FEATURED } from "@/lib/featured";
import { vehiclePath } from "@/lib/vehicle-slug";
import type { VehicleRow } from "@/components/admin/VehiclesTable";

export function SheetActions({
  vehicle,
  busy,
  close,
  onStatus,
  onFeatured,
  onDuplicate,
  onMarkSold,
  onMarkSoldSimple,
  onDelete,
  onPromo,
}: {
  vehicle: VehicleRow;
  busy: boolean;
  close: () => void;
  onStatus: (status: string) => void;
  onFeatured: () => void;
  onDuplicate: () => void;
  onMarkSold: () => void;
  onMarkSoldSimple: () => void;
  onDelete: () => void;
  onPromo?: () => void;
}) {
  const run = (action: () => void) => () => {
    close();
    action();
  };
  const beforeDelete = ADMIN_CARD_OVERFLOW_ACTIONS.filter(
    (action) => action !== "excluir",
  );

  return (
    <>
      <ActionSheetLink
        href={`/admin/veiculos/${vehicle.id}`}
        icon={<IconPencil className="h-4 w-4" />}
        label="Editar anúncio"
        hint="Preço, fotos e ficha"
        onNavigate={close}
      />
      {onPromo ? (
        <ActionSheetButton
          icon={<IconExternal className="h-4 w-4" />}
          label="Kit de divulgação"
          hint="WhatsApp, Instagram e card Status"
          onClick={run(onPromo)}
        />
      ) : null}
      {beforeDelete.map((action) => (
        <OverflowAction
          key={action}
          action={action}
          vehicle={vehicle}
          busy={busy}
          close={close}
          run={run}
          onFeatured={onFeatured}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ))}
      {adminCardOverflowStatuses(vehicle.status).map((option) => (
        <ActionSheetButton
          key={option.value}
          icon={<IconCheck className="h-4 w-4" />}
          label={option.label}
          disabled={busy}
          onClick={run(() => onStatus(option.value))}
        />
      ))}
      {adminCardShowsSoldAction(vehicle.status) ? (
        <>
          <ActionSheetButton
            icon={<IconCheck className="h-4 w-4" />}
            label="Marcar como vendida (simples)"
            hint="Sem comprador, preço ou registro de faturamento"
            disabled={busy}
            onClick={run(onMarkSoldSimple)}
          />
          <ActionSheetButton
            icon={<IconCash className="h-4 w-4" />}
            label="Registrar venda completa"
            hint="Abre o formulário atual de venda"
            tone="warning"
            disabled={busy}
            onClick={run(onMarkSold)}
          />
        </>
      ) : null}
      <OverflowAction
        action="excluir"
        vehicle={vehicle}
        busy={busy}
        close={close}
        run={run}
        onFeatured={onFeatured}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    </>
  );
}

function OverflowAction({
  action,
  vehicle,
  busy,
  close,
  run,
  onFeatured,
  onDuplicate,
  onDelete,
}: {
  action: AdminCardOverflowAction;
  vehicle: VehicleRow;
  busy: boolean;
  close: () => void;
  run: (action: () => void) => () => void;
  onFeatured: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  if (action === "operacao") {
    return (
      <ActionSheetLink
        href={`/admin/veiculos/${vehicle.id}?view=operacao`}
        icon={<IconClipboard className="h-4 w-4" />}
        label="Operação"
        hint="Custos, documentos, chave e manual"
        onNavigate={close}
      />
    );
  }
  if (action === "site") {
    return (
      <ActionSheetLink
        href={vehiclePath(vehicle)}
        external
        icon={<IconExternal className="h-4 w-4" />}
        label="Ver no site"
        onNavigate={close}
      />
    );
  }
  if (action === "destacar") {
    return (
      <ActionSheetButton
        icon={<IconStar className="h-4 w-4" filled={vehicle.featured} />}
        label={vehicle.featured ? "Tirar da vitrine" : "Destacar na home"}
        hint={`Até ${MAX_HOME_FEATURED} destaques`}
        disabled={busy}
        onClick={run(onFeatured)}
      />
    );
  }
  if (action === "duplicar") {
    return (
      <ActionSheetButton
        icon={<IconCopy className="h-4 w-4" />}
        label="Duplicar anúncio"
        disabled={busy}
        onClick={run(onDuplicate)}
      />
    );
  }
  return (
    <ActionSheetButton
      icon={<IconTrash className="h-4 w-4" />}
      label="Excluir definitivamente"
      hint="Só para duplicata ou erro — a página vira 404"
      tone="danger"
      onClick={run(onDelete)}
    />
  );
}
