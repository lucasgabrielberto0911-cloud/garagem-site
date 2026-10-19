import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { isSameOriginRequest } from "@/lib/admin-request-origin";
import { checkDistributedRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { parseSiteFunnel } from "@/lib/site-funnel";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (!request.headers.get("origin") || !isSameOriginRequest(request)) return NextResponse.json({}, { status: 403, headers });
  if (Number(request.headers.get("content-length")) > 1024) return NextResponse.json({}, { status: 413, headers });
  try {
    const text = await request.text();
    if (text.length > 1024) return NextResponse.json({}, { status: 413, headers });
    const body = parseSiteFunnel(JSON.parse(text));
    if (!body) return NextResponse.json({}, { status: 400, headers });
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = createHash("sha256").update(`funil:${ip}`).digest("hex");
    const limit = await checkDistributedRateLimit(`funil:${key}`, { windowMs: 60000, max: 30 });
    if (!limit.ok) return NextResponse.json({}, { status: 429, headers });
    if (body.vehicleId && !await prisma.vehicle.findFirst({ where: { id: body.vehicleId, historical: false }, select: { id: true } })) return NextResponse.json({}, { status: 400, headers });
    // Diário existente, namespace reservado: dispensa DDL em produção e não altera auditorias administrativas.
    await prisma.adminAudit.create({ data: { adminId: `site:${body.origin}`, entityId: body.vehicleId || "site", action: `site:${body.event}`, changes: {} } });
    return new NextResponse(null, { status: 204, headers });
  } catch {
    return NextResponse.json({}, { status: 400, headers });
  }
}
