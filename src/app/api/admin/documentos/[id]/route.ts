import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commercialPdf, type DocumentSnapshot } from "@/lib/commercial-pdf";

export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSession())) {
    return new Response("Sessão expirada.", { status: 401, headers });
  }

  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id || "").trim();
    if (!decodedId) {
      return new Response("ID inválido.", { status: 400, headers });
    }

    const doc = await prisma.commercialDocument.findUnique({
      where: { id: decodedId },
    });
    if (!doc) {
      return new Response("Documento não encontrado.", {
        status: 404,
        headers,
      });
    }

    const inline = new URL(request.url).searchParams.has("inline");
    const bytes = await commercialPdf(
      doc.kind,
      doc.snapshot as DocumentSnapshot,
      doc.id,
      doc.number,
    );

    return new Response(Buffer.from(bytes), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="garagem-${doc.kind}-${doc.number}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[admin/documentos/[id]]", error);
    return new Response("Não foi possível gerar o PDF.", {
      status: 500,
      headers,
    });
  }
}
