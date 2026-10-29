import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { promissoryPdf } from "@/lib/promissory-pdf";
import { promissoryRowToPdfInput } from "@/lib/promissory-notes";

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

    const note = await prisma.promissoryNote.findUnique({ where: { id: decodedId } });
    if (!note) {
      return new Response("Nota promissória não encontrada.", { status: 404, headers });
    }

    if (note.status === "cancelada") {
      return new Response("Nota cancelada não pode ser impressa.", { status: 409, headers });
    }

    const inline = new URL(request.url).searchParams.has("inline");
    const bytes = await promissoryPdf(promissoryRowToPdfInput(note));

    return new Response(Buffer.from(bytes), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="garagem-promissoria-${note.number}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[admin/promissorias/[id]]", error);
    return new Response("Não foi possível gerar o PDF.", { status: 500, headers });
  }
}
