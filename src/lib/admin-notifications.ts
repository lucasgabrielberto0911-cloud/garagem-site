export const NOTICE_KINDS = [
  { value: "hoje", label: "Hoje" },
  { value: "atrasados", label: "Atrasados" },
  { value: "vendas", label: "Vendas" },
  { value: "pedidos", label: "Pedidos" },
] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number]["value"];
export function parseNoticeKind(value: string | null): NoticeKind {
  return value === "atrasados" || value === "vendas" || value === "pedidos" ? value : "hoje";
}
export type NoticesResult = {
  kind: NoticeKind;
  counts: Record<NoticeKind, number>;
  items: { id: string; title: string; detail: string; href: string; at?: string | null; leadId?: string; vehicleId?: string; vehicleHref?: string; whatsappHref?: string | null; criteria?: string }[];
  total: number; page: number; pages: number;
};
