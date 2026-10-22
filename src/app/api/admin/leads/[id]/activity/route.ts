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
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id || "").trim();
    if (!decodedId) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400, headers });
    }
    const lead = await prisma.leadVenda.findUnique({
      where: { id: decodedId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json(
        { error: "Lead não encontrado." },
        { status: 404, headers },
      );
    }
    return NextResponse.json(await loadLeadActivity(decodedId), { headers });
  } catch (error) {
    console.error("[admin/leads/activity GET]", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o histórico." },
      { status: 500, headers },
    );
  }
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
    return NextResponse.json({}, { status: 403, headers });

  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id || "").trim();
    if (!decodedId) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400, headers });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "JSON inválido." },
        { status: 400, headers },
      );
    }

    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json(
        { error: "Corpo da requisição inválido." },
        { status: 400, headers },
      );
    }

    const body = rawBody as Record<string, unknown>;
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

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.leadVenda.findUnique({
        where: { id: decodedId },
        select: { nextAction: true, nextActionAt: true },
      });
      if (!existing) {
        return { notFound: true };
      }
      await tx.leadActivity.create({
        data: { leadId: decodedId, adminId: session.adminId, note },
      });
      if (nextAction && nextActionAt) {
        const prevTime = existing.nextActionAt
          ? existing.nextActionAt.getTime()
          : null;
        if (
          prevTime !== nextActionAt.getTime() ||
          existing.nextAction !== nextAction
        ) {
          await tx.leadActivity.create({
            data: {
              leadId: decodedId,
              adminId: session.adminId,
              note: `[retorno:${nextActionAt.toISOString()}] Retorno agendado para ${adminActionDate(nextActionAt)}: ${nextAction}`,
            },
          });
        }
      }
      await tx.leadVenda.update({
        where: { id: decodedId },
        data: { nextAction: nextAction || null, nextActionAt },
      });
      return { ok: true };
    });

    if ("notFound" in result) {
      return NextResponse.json(
        { error: "Lead não encontrado." },
        { status: 404, headers },
      );
    }

    expireAdminData();
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    console.error("[admin/leads/activity POST]", error);
    return NextResponse.json(
      { error: "Não foi possível salvar. O texto continua nesta tela." },
      { status: 500, headers },
    );
  }
}
