import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { preparationPdf } from "@/lib/commercial-pdf";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET() {
  if (!(await getSession())) return new Response("Sessão expirada.", { status: 401, headers });
  try {
    const rows = await prisma.preparationVehicle.findMany({ orderBy: [{ brand: "asc" }, { model: "asc" }] });
    const bytes = await preparationPdf(rows.map((r) => ({ ...r, purchasedAt: r.purchasedAt?.toISOString() ?? null })));
    return new Response(Buffer.from(bytes), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="garagem-carros-em-preparacao.pdf"' } });
  } catch {
    return new Response("Não foi possível gerar o PDF.", { status: 500, headers });
  }
}
