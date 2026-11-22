export const NOTICE_KINDS = [
  { value: "vendas", label: "Vendas" },
] as const;

export type NoticeKind = (typeof NOTICE_KINDS)[number]["value"];

export function parseNoticeKind(_value: string | null): NoticeKind {
  return "vendas";
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
