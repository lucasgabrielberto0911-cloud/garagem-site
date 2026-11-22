import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { ADMIN_DATA_TAG } from "./admin-cache";
import { MISSING_SALE_COST_WHERE } from "./admin-cost-warnings";

const loadNoticeSnapshot = unstable_cache(
  async () => {
    const vendas = await prisma.sale.count({ where: MISSING_SALE_COST_WHERE });
    return {
      counts: { vendas },
    };
  },
  ["admin-notice-snapshot-v4"],
  { revalidate: 15, tags: [ADMIN_DATA_TAG] },
);

export function getAdminNoticeSnapshot() {
  return loadNoticeSnapshot();
}
