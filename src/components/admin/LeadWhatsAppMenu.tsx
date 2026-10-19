"use client";

import { useState } from "react";
import { ActionSheet, ActionSheetLink } from "@/components/admin/ActionSheet";
import { IconChevronDown } from "@/components/admin/icons";
import { IconWhatsApp } from "@/components/site/icons";
import { leadWhatsAppTemplates } from "@/lib/lead-whatsapp-templates";
import { buildLeadWhatsAppUrl, leadDisplayName } from "@/lib/leads";

type MenuLead = {
  name: string;
  phone: string;
  vehicleInfo?: string | null;
  plate?: string | null;
  source?: string | null;
};

/** WhatsApp direto (mensagem padrão da origem) mais um menu de modelos prontos. */
export function LeadWhatsAppMenu({
  lead,
  className,
  menuClassName,
}: {
  lead: MenuLead;
  className: string;
  menuClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const templates = leadWhatsAppTemplates(lead);
  const close = () => setOpen(false);

  return (
    <>
      <a
        href={buildLeadWhatsAppUrl(lead)}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <IconWhatsApp className="h-4 w-4" />
        WhatsApp
      </a>
      <button
        type="button"
        aria-label={`Mensagens prontas para ${leadDisplayName(lead)}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={menuClassName}
      >
        <IconChevronDown className="h-4 w-4" />
      </button>
      <ActionSheet
        open={open}
        title="Mensagens prontas"
        subtitle={leadDisplayName(lead)}
        onClose={close}
      >
        <ActionSheetLink
          icon={<IconWhatsApp className="h-4 w-4" />}
          label="Mensagem padrão"
          hint="A abordagem da origem do lead"
          href={buildLeadWhatsAppUrl(lead)}
          external
          onNavigate={close}
        />
        {templates.map((template) => (
          <ActionSheetLink
            key={template.id}
            icon={<IconWhatsApp className="h-4 w-4" />}
            label={template.label}
            hint={template.hint}
            href={template.href}
            external
            onNavigate={close}
          />
        ))}
      </ActionSheet>
    </>
  );
}
