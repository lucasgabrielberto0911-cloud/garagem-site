import { isSameOriginRequest } from "@/lib/admin-request-origin";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminActionDate, businessDay } from "@/lib/admin-date";
import { expireAdminData } from "@/lib/admin-revalidate";
import { buildLeadTimeline } from "@/lib/lead-timeline";
import { isMissingColumnError } from "@/lib/prisma-errors";

const headers = { "Cache-Control": "private, no-store" };

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSession()))
    return NextResponse.json({}, { status: 401, headers });
  const { id } = await params;
  const [lead, activities] = await Promise.all([
    findLeadForTimeline(id),
    prisma.leadActivity.findMany({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!lead) {
    return NextResponse.json({ activities, timeline: [] }, { headers });
  }

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
            .catch(() => []),
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
            .catch(() => null),
        ])
      : [[], null];

  const timeline = buildLeadTimeline({
    lead,
    activities,
    previousLeads,
    customer,
  });

  return NextResponse.json({ activities, timeline }, { headers });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json(
      { error: "Sessão expirada. Entre novamente em outra aba." },
      { status: 401, headers },
    );
  if (!isSameOriginRequest(request))
    return NextResponse.json({}, { status: 403 });
  try {
    const { id } = await params;
    const body = await request.json();
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const nextAction =
      typeof body.nextAction === "string" ? body.nextAction.trim() : "";
    const dateStr = typeof body.date === "string" ? body.date.trim() : "";
    const timeStr = typeof body.time === "string" ? body.time.trim() : "";
    const nextActionAt = dateStr ? businessDay(dateStr, timeStr) : null;
    if (
      !note ||
      note.length > 2000 ||
      nextAction.length > 300 ||
      (timeStr && !dateStr) ||
      (nextActionAt && Number.isNaN(nextActionAt.getTime())) ||
      (nextActionAt && !nextAction)
    )
      return NextResponse.json(
        {
          error:
            "Informe um registro de contato e confira a próxima ação/data.",
        },
        { status: 400, headers },
      );
    await prisma.$transaction(async (tx) => {
      const existing = await tx.leadVenda.findUnique({
        where: { id },
        select: { nextAction: true, nextActionAt: true },
      });
      await tx.leadActivity.create({
        data: { leadId: id, adminId: session.adminId, note },
      });
      if (nextAction && nextActionAt) {
        const prevTime = existing?.nextActionAt
          ? existing.nextActionAt.getTime()
          : null;
        if (
          prevTime !== nextActionAt.getTime() ||
          existing?.nextAction !== nextAction
        ) {
          await tx.leadActivity.create({
            data: {
              leadId: id,
              adminId: session.adminId,
              note: `[retorno:${nextActionAt.toISOString()}] Retorno agendado para ${adminActionDate(nextActionAt)}: ${nextAction}`,
            },
          });
        }
      }
      await tx.leadVenda.update({
        where: { id },
        data: { nextAction: nextAction || null, nextActionAt },
      });
    });
    expireAdminData();
    return NextResponse.json({ ok: true }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível salvar. O texto continua nesta tela." },
      { status: 500, headers },
    );
  }
}
