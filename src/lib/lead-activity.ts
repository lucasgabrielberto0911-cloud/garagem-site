import { prisma } from "@/lib/prisma";
import { buildLeadTimeline } from "@/lib/lead-timeline";
import { isMissingColumnError } from "@/lib/prisma-errors";

const LEAD_TIMELINE_SELECT = {
  id: true,
  name: true,
  phone: true,
  vehicleInfo: true,
  status: true,
  source: true,
  nextAction: true,
  nextActionAt: true,
  createdAt: true,
} as const;

async function findLeadForTimeline(id: string) {
  try {
    return await prisma.leadVenda.findUnique({
      where: { id },
      select: { ...LEAD_TIMELINE_SELECT, lostReason: true },
    });
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    const row = await prisma.leadVenda.findUnique({
      where: { id },
      select: LEAD_TIMELINE_SELECT,
    });
    return row ? { ...row, lostReason: null } : null;
  }
}

export async function loadLeadActivity(id: string) {
  const [lead, activities] = await Promise.all([
    findLeadForTimeline(id),
    prisma.leadActivity.findMany({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!lead) {
    return { activities, timeline: [], partial: false };
  }

  let partial = false;
  const digits = lead.phone.replace(/\D/g, "");
  const [previousLeads, customer] =
    digits.length >= 10
      ? await Promise.all([
          prisma.leadVenda
            .findMany({
              where: {
                id: { not: id },
                phone: { in: [lead.phone, digits] },
              },
              orderBy: { createdAt: "desc" },
              take: 10,
              select: {
                id: true,
                createdAt: true,
                vehicleInfo: true,
                status: true,
                source: true,
                activities: {
                  orderBy: { createdAt: "desc" },
                  take: 10,
                  select: { id: true, note: true, createdAt: true },
                },
              },
            })
            .catch(() => {
              partial = true;
              console.error("[leads/activity] Linha do tempo parcial: falha ao consultar leads anteriores.");
              return [];
            }),
          prisma.customer
            .findFirst({
              where: { phone: { in: [lead.phone, digits] } },
              select: {
                id: true,
                name: true,
                createdAt: true,
                sales: {
                  orderBy: { saleDate: "desc" },
                  take: 10,
                  select: {
                    id: true,
                    salePrice: true,
                    paymentMethod: true,
                    saleDate: true,
                    vehicle: {
                      select: { brand: true, model: true, yearModel: true },
                    },
                  },
                },
              },
            })
            .catch(() => {
              partial = true;
              console.error("[leads/activity] Linha do tempo parcial: falha ao consultar cliente e vendas.");
              return null;
            }),
        ])
      : [[], null];

  const timeline = buildLeadTimeline({
    lead,
    activities,
    previousLeads,
    customer,
  });

  return { activities, timeline, partial };
}
