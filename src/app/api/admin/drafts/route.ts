import { isSameOriginRequest } from "@/lib/admin-request-origin";
import { withAdminStorageLock } from "@/lib/admin-storage-lock";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { draftVersionMatches } from "@/lib/admin-draft-version";
const headers = { "Cache-Control": "private, no-store" };
function validKey(key: string) {
  return /^[a-zA-Z0-9:_-]{1,100}$/.test(key);
}
export async function GET(request: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json(
      { error: "Sessão expirada. Entre novamente para retomar." },
      { status: 401, headers },
    );
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!validKey(key))
    return NextResponse.json(
      { error: "Rascunho inválido." },
      { status: 400, headers },
    );
  try {
    await prisma.adminDraft.deleteMany({
      where: { adminId: session.adminId, expiresAt: { lte: new Date() } },
    });
    const draft = await prisma.adminDraft.findUnique({
      where: { adminId_key: { adminId: session.adminId, key } },
    });
    return NextResponse.json({ draft }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Rascunhos indisponíveis. Seus campos continuam nesta tela." },
      { status: 503, headers },
    );
  }
}
export async function POST(request: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json(
      {
        error:
          "Sessão expirada. Seu formulário continua nesta tela; entre novamente em outra aba.",
      },
      { status: 401, headers },
    );
  if (!isSameOriginRequest(request))
    return NextResponse.json({}, { status: 403 });
  const raw = await request.text();
  if (raw.length > 128000)
    return NextResponse.json(
      { error: "Rascunho muito grande." },
      { status: 413, headers },
    );
  try {
    const body = JSON.parse(raw);
    const { key, payload, photoUrls, reserve, expectedUpdatedAt } = body;
    if (
      typeof key !== "string" ||
      !validKey(key) ||
      (!reserve &&
        (!payload || typeof payload !== "object" || Array.isArray(payload))) ||
      !Array.isArray(photoUrls) ||
      photoUrls.length > 100 ||
      photoUrls.some((p: unknown) => typeof p !== "string")
    )
      return NextResponse.json({}, { status: 400, headers });
    const result = await withAdminStorageLock(async (tx) => {
      const expiresAt = new Date(Date.now() + 30 * 86400000);
      await tx.adminDraft.deleteMany({
        where: { adminId: session.adminId, expiresAt: { lte: new Date() } },
      });
      const where = { adminId_key: { adminId: session.adminId, key } };
      const existing = await tx.adminDraft.findUnique({ where });
      // Reservar fotos cria uma linha vazia, que ainda não representa campos salvos.
      const hasPayload = Boolean((existing?.payload as { fields?: unknown } | undefined)?.fields);
      if (!reserve && Object.hasOwn(body, "expectedUpdatedAt") &&
          !draftVersionMatches(expectedUpdatedAt, hasPayload ? existing!.updatedAt : null)) {
        return { conflict: true as const, updatedAt: hasPayload ? existing!.updatedAt.toISOString() : null };
      }
      const stored = existing?.payload as
        { photos?: Array<{ url?: string; thumbnailUrl?: string }> } | undefined;
      const savedUrls = Array.isArray(stored?.photos)
        ? stored.photos.flatMap((p) =>
            [p.url, p.thumbnailUrl].filter(
              (url): url is string => typeof url === "string",
            ),
          )
        : [];
      const protectedUrls = [...new Set([...savedUrls, ...photoUrls])];
      const saved = await tx.adminDraft.upsert({
        where,
        create: {
          adminId: session.adminId,
          key,
          payload: reserve ? {} : payload,
          photoUrls: protectedUrls,
          expiresAt,
        },
        update: {
          ...(reserve ? {} : { payload }),
          photoUrls: protectedUrls,
          expiresAt,
          ...(existing ? { updatedAt: reserve ? existing.updatedAt : new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)) } : {}),
        },
      });
      return { conflict: false as const, updatedAt: saved.updatedAt.toISOString() };
    });
    if (result.conflict) return NextResponse.json({ error: "Este rascunho mudou em outro acesso. Seus campos continuam nesta tela.", updatedAt: result.updatedAt }, { status: 409, headers });
    return NextResponse.json({ ok: true, updatedAt: result.updatedAt }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível guardar o rascunho." },
      { status: 400, headers },
    );
  }
}
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({}, { status: 401, headers });
  if (!isSameOriginRequest(request))
    return NextResponse.json({}, { status: 403 });
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!validKey(key)) return NextResponse.json({}, { status: 400, headers });
  await prisma.adminDraft.deleteMany({
    where: { adminId: session.adminId, key },
  });
  return NextResponse.json({ ok: true }, { headers });
}
