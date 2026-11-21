export const NOTICE_KINDS = [
  { value: "carros", label: "Carros" },
  { value: "vendas", label: "Vendas" },
] as const;

export type NoticeKind = (typeof NOTICE_KINDS)[number]["value"];

export function parseNoticeKind(value: string | null): NoticeKind {
  return value === "vendas" ? "vendas" : "carros";
}

export type NoticesResult = {
  kind: NoticeKind;
  counts: Record<NoticeKind, number>;
  items: {
    id: string;
    title: string;
    detail: string;
    href: string;
  }[];
  total: number;
  page: number;
  pages: number;
};
