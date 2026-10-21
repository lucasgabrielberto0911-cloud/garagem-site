import { isSameOriginRequest } from "@/lib/admin-request-origin";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminActionDate, businessDay } from "@/lib/admin-date";
import { expireAdminData } from "@/lib/admin-revalidate";
import { loadLeadActivity } from "@/lib/lead-activity";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSession()))
    return NextResponse.json({}, { status: 401, headers });
  const { id } = await params;
  return NextResponse.json(await loadLeadActivity(id), { headers });
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
