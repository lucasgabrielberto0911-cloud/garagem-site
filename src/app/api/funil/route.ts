import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { isSameOriginRequest } from "@/lib/admin-request-origin";
import { checkDistributedRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { parseSiteFunnel } from "@/lib/site-funnel";

const headers = { "Cache-Control": "private, no-store" };
const MAX_BODY_BYTES = 1024;

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  if (!request.headers.get("origin") || !isSameOriginRequest(request))
    return NextResponse.json({}, { status: 403, headers });

  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = createHash("sha256").update(`funil:${ip}`).digest("hex");
    const limit = await checkDistributedRateLimit(`funil:${key}`, {
      windowMs: 60000,
      max: 30,
      failClosed: true,
    });
    if (!limit.ok)
      return NextResponse.json({}, {
        status: limit.unavailable ? 503 : 429,
        headers: { ...headers, "Retry-After": String(limit.retryAfterSec ?? 30) },
      });
  } catch {
    console.error("[funil] Limitador indisponível.");
    return NextResponse.json({}, { status: 503, headers });
  }

  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES)
    return NextResponse.json({}, { status: 413, headers });

  let body;
  try {
    const text = await readBody(request);
    if (text === null) return NextResponse.json({}, { status: 413, headers });
    body = parseSiteFunnel(JSON.parse(text));
    if (!body) return NextResponse.json({}, { status: 400, headers });
  } catch {
    return NextResponse.json({}, { status: 400, headers });
  }

  try {
    if (body.vehicleId && !await prisma.vehicle.findFirst({ where: { id: body.vehicleId, historical: false }, select: { id: true } }))
      return NextResponse.json({}, { status: 400, headers });
    // Diário existente, namespace reservado: dispensa DDL em produção e não altera auditorias administrativas.
    await prisma.adminAudit.create({ data: { adminId: `site:${body.origin}`, entityId: body.vehicleId || "site", action: `site:${body.event}`, changes: {} } });
    return new NextResponse(null, { status: 204, headers });
  } catch {
    console.error("[funil] Banco indisponível ao registrar evento.");
    return NextResponse.json({}, { status: 503, headers });
  }
}
