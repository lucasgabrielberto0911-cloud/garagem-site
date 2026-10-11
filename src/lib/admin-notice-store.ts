import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { localDateInput } from "./admin-date";
import { ADMIN_DATA_TAG, ADMIN_NEW_LEADS_TAG } from "./admin-cache";
import { MISSING_SALE_COST_WHERE } from "./admin-cost-warnings";
import { getWantedStockMatches } from "./wanted-stock-match-store";

const loadNoticeSnapshot = unstable_cache(async (day: string) => {
  const start = new Date(`${day}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 86400000);
  const [rows, vendas, matches] = await Promise.all([
    prisma.$queryRaw<Array<{ count: number; hoje: number; atrasados: number }>>`
      SELECT count(*) FILTER (WHERE status = 'novo')::int AS count,
        count(*) FILTER (WHERE status NOT IN ('fechado', 'perdido') AND "nextActionAt" >= ${start} AND "nextActionAt" < ${end})::int AS hoje,
        count(*) FILTER (WHERE status NOT IN ('fechado', 'perdido') AND "nextActionAt" < ${start})::int AS atrasados
      FROM "LeadVenda" WHERE status = 'novo' OR (status NOT IN ('fechado', 'perdido') AND "nextActionAt" < ${end})
    `,
    prisma.sale.count({ where: MISSING_SALE_COST_WHERE }),
    getWantedStockMatches(),
  ]);
  const { count, hoje, atrasados } = rows[0];
  return { count, counts: { hoje, atrasados, vendas, pedidos: matches.length }, matches };
}, ["admin-notice-snapshot-v1"], { revalidate: 15, tags: [ADMIN_DATA_TAG, ADMIN_NEW_LEADS_TAG] });

/** A data local integra a chave: não serve o dia anterior depois da meia-noite. */
export function getAdminNoticeSnapshot(now = new Date()) {
  return loadNoticeSnapshot(localDateInput(now));
}
