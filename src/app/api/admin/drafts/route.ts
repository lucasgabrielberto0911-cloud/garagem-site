import { isSameOriginRequest } from "@/lib/admin-request-origin";
import { withAdminStorageLock } from "@/lib/admin-storage-lock";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    const { key, payload, photoUrls, reserve } = JSON.parse(raw);
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
    await withAdminStorageLock(async (tx) => {
      const expiresAt = new Date(Date.now() + 30 * 86400000);
      await tx.adminDraft.deleteMany({
        where: { adminId: session.adminId, expiresAt: { lte: new Date() } },
      });
      const where = { adminId_key: { adminId: session.adminId, key } };
      const existing = reserve
        ? await tx.adminDraft.findUnique({ where })
        : null;
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
      await tx.adminDraft.upsert({
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
        },
      });
    });
    return NextResponse.json({ ok: true }, { headers });
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
