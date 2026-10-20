import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commercialPdf, type DocumentSnapshot } from "@/lib/commercial-pdf";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new Response("Sessão expirada.", { status: 401, headers });
  const { id } = await params;
  const doc = await prisma.commercialDocument.findUnique({ where: { id } });
  if (!doc) return new Response("Documento não encontrado.", { status: 404, headers });
  try {
    const bytes = await commercialPdf(doc.kind, doc.snapshot as DocumentSnapshot, doc.id, doc.number);
    return new Response(Buffer.from(bytes), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `${new URL(request.url).searchParams.has("inline") ? "inline" : "attachment"}; filename="garagem-${doc.kind}-${doc.number}.pdf"` } });
  } catch {
    return new Response("Não foi possível gerar o PDF.", { status: 500, headers });
  }
}
