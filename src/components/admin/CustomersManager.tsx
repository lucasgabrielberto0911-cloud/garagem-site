"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconPencil, IconPlus, IconTrash, IconUsers } from "@/components/admin/icons";
import { IconPhone, IconWhatsApp } from "@/components/site/icons";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  btn,
  inputClass,
  mobileActionCell,
} from "@/components/admin/ui";
import { deleteCustomer, saveCustomer } from "@/app/admin/clientes/actions";
import { formatCpfBR, formatCurrencyBRL, formatPhoneBR } from "@/lib/format";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  purchases: number;
  totalSpent: number;
  lastPurchase: Date | null;
};

const emptyForm = {
  id: "",
  name: "",
  phone: "",
  cpf: "",
  email: "",
  address: "",
  notes: "",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

export function CustomersManager({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [term, setTerm] = useState("");
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<CustomerRow | null>(null);

  const filtered = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return customers;
    const digits = query.replace(/\D/g, "");
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        (digits && customer.phone.includes(digits)) ||
        (customer.email ?? "").toLowerCase().includes(query),
    );
  }, [customers, term]);

  function openCreate() {
    setErrors({});
    setForm({ ...emptyForm });
  }

  function openEdit(customer: CustomerRow) {
    setErrors({});
    setForm({
      id: customer.id,
      name: customer.name,
      phone: formatPhoneBR(customer.phone),
      cpf: customer.cpf ? formatCpfBR(customer.cpf) : "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveCustomer(formData);
      setErrors(result.fieldErrors ?? {});

      if (result.ok) {
        toast.success(result.message);
        setForm(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      const result = await deleteCustomer(target.id);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
      setDeleteTarget(null);
    });
  }

  return (
    <div className="space-y-5">
      {form ? (
        <Card title={form.id ? "Editar cliente" : "Novo cliente"}>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <input type="hidden" name="id" value={form.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" required error={errors.name}>
                <input
                  name="name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  placeholder="Nome completo"
                  className={inputClass}
                />
              </Field>
              <Field label="Telefone / WhatsApp" required error={errors.phone}>
                <input
                  name="phone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? { ...current, phone: formatPhoneBR(event.target.value) }
                        : current,
                    )
                  }
                  placeholder="(00) 00000-0000"
                  className={inputClass}
                />
              </Field>
              <Field label="CPF" error={errors.cpf}>
                <input
                  name="cpf"
                  inputMode="numeric"
                  value={form.cpf}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? { ...current, cpf: formatCpfBR(event.target.value) }
                        : current,
                    )
                  }
                  placeholder="000.000.000-00"
                  className={inputClass}
                />
              </Field>
              <Field label="E-mail" error={errors.email}>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, email: event.target.value } : current,
                    )
                  }
                  placeholder="cliente@email.com"
                  className={inputClass}
                />
              </Field>
              <Field label="Endereço" className="sm:col-span-2">
                <input
                  name="address"
                  value={form.address}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, address: event.target.value } : current,
                    )
                  }
                  placeholder="Rua, número, bairro, cidade"
                  className={inputClass}
                />
              </Field>
              <Field label="Observações" className="sm:col-span-2">
                <textarea
                  name="notes"
                  rows={3}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, notes: event.target.value } : current,
                    )
                  }
                  placeholder="Preferências, veículo procurado, histórico de contato..."
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              <button type="submit" disabled={isPending} className={btn.primary}>
                {isPending ? "Salvando..." : form.id ? "Salvar" : "Cadastrar"}
              </button>
              <button
                type="button"
                onClick={() => setForm(null)}
                className={btn.outline}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail"
            className={`${inputClass} sm:max-w-sm`}
          />
          <button
            type="button"
            onClick={openCreate}
            className={`${btn.primary} w-full sm:w-auto`}
          >
            <IconPlus className="h-4 w-4" />
            Novo cliente
          </button>
          {term ? (
            <span className="text-xs text-muted">
              {filtered.length} resultado(s)
            </span>
          ) : null}
        </div>
      )}

      {customers.length === 0 ? (
        <EmptyState
          icon={<IconUsers className="h-12 w-12" />}
          title="Nenhum cliente cadastrado"
          description="Cadastre clientes para registrar vendas e manter o histórico de contato organizado."
          action={
            <button type="button" onClick={openCreate} className={btn.primary}>
              <IconPlus className="h-4 w-4" />
              Cadastrar cliente
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Tente outro nome, telefone ou e-mail."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {filtered.map((customer) => (
            <li
              key={customer.id}
              className="overflow-hidden border border-white/10 bg-ink/50"
            >
              <div className="p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-cream">
                      {customer.name}
                    </p>
                    <p className="text-xs text-muted">
                      {formatPhoneBR(customer.phone)}
                      {customer.email ? ` · ${customer.email}` : ""}
                    </p>
                    {customer.cpf ? (
                      <p className="text-xs text-muted">
                        CPF {formatCpfBR(customer.cpf)}
                      </p>
                    ) : null}
                  </div>
                  {customer.purchases > 0 ? (
                    <Badge tone="success">
                      {customer.purchases} compra{customer.purchases > 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <Badge>Sem compras</Badge>
                  )}
                </div>

                {customer.purchases > 0 ? (
                  <p className="mt-3 text-xs text-muted">
                    Total {formatCurrencyBRL(customer.totalSpent)}
                    {customer.lastPurchase
                      ? ` · última em ${formatDate(customer.lastPurchase)}`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-muted">
                    Cadastrado em {formatDate(customer.createdAt)}
                  </p>
                )}

                {customer.notes ? (
                  <p className="mt-2 line-clamp-2 text-xs italic text-muted">
                    {customer.notes}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-4 border-t border-white/10">
                <a
                  href={`https://wa.me/55${customer.phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={mobileActionCell}
                  aria-label="WhatsApp"
                  title="WhatsApp"
                >
                  <IconWhatsApp className="h-4 w-4" />
                  Zap
                </a>
                <a
                  href={`tel:+55${customer.phone}`}
                  className={`${mobileActionCell} border-l border-white/10`}
                  aria-label="Ligar"
                  title="Ligar"
                >
                  <IconPhone className="h-4 w-4" />
                  Ligar
                </a>
                <button
                  type="button"
                  onClick={() => openEdit(customer)}
                  className={`${mobileActionCell} border-l border-white/10`}
                  aria-label="Editar cliente"
                  title="Editar"
                >
                  <IconPencil className="h-4 w-4" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(customer)}
                  className={`${mobileActionCell} border-l border-white/10 text-brand`}
                  aria-label="Excluir cliente"
                  title="Excluir"
                >
                  <IconTrash className="h-4 w-4" />
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir cliente"
        description={
          deleteTarget
            ? `Excluir ${deleteTarget.name}? O histórico de contato será perdido.`
            : undefined
        }
        confirmLabel="Excluir"
        danger
        loading={isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
