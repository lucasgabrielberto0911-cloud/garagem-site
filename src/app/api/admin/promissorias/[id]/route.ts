import { getSession } from "@/lib/auth";
import { formatCpfBR } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { promissoryBatchPdf, promissoryPdf } from "@/lib/promissory-pdf";
import { PROMISSORY_COMPAT_OMIT, PROMISSORY_MAX_INSTALLMENTS, promissoryRowToPdfInput } from "@/lib/promissory-notes";

export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
const OPEN_STATUSES = ["emitida", "vinculada"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSession())) {
    return new Response("Sessão expirada.", { status: 401, headers });
  }

  try {
    const url = new URL(request.url);
    const inline = url.searchParams.has("inline");
    const rawCpf = url.searchParams.get("cpf")?.trim() ?? "";

    if (rawCpf) {
      const digits = rawCpf.replace(/\D/g, "");
      if (digits.length !== 11) {
        return new Response("CPF inválido.", { status: 400, headers });
      }
      const cpfVariants = Array.from(new Set([rawCpf, digits, formatCpfBR(digits)]));
      const notes = await prisma.promissoryNote.findMany({
        omit: PROMISSORY_COMPAT_OMIT,
        where: {
          issuerCpf: { in: cpfVariants },
          status: { in: OPEN_STATUSES },
        },
        orderBy: [{ number: "asc" }],
        take: PROMISSORY_MAX_INSTALLMENTS + 1,
      });
      if (notes.length > PROMISSORY_MAX_INSTALLMENTS) return new Response("Há mais de 60 notas abertas. Selecione até 60 notas por lote na aba Promissórias.", { status: 400, headers });
      if (notes.length === 0) {
        return new Response("Nota promissória não encontrada.", { status: 404, headers });
      }
      if (notes.length === 1) {
        const note = notes[0];
        const bytes = await promissoryPdf(promissoryRowToPdfInput(note));
        return new Response(Buffer.from(bytes), {
          headers: {
            ...headers,
            "Content-Type": "application/pdf",
            "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="garagem-promissoria-${note.number}.pdf"`,
          },
        });
      }
      const bytes = await promissoryBatchPdf(notes.map((note) => promissoryRowToPdfInput(note)));
      const firstNumber = notes[0].number;
      const lastNumber = notes[notes.length - 1].number;
      return new Response(Buffer.from(bytes), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="garagem-promissorias-${firstNumber}-a-${lastNumber}.pdf"`,
        },
      });
    }

    const { id } = await params;
    const decodedId = decodeURIComponent(id || "").trim();
    const ids = Array.from(new Set(decodedId.split(",").map((part) => part.trim()).filter(Boolean)));
    if (ids.length === 0 || ids.length > PROMISSORY_MAX_INSTALLMENTS) {
      return new Response("ID inválido.", { status: 400, headers });
    }

    if (ids.length === 1) {
      const note = await prisma.promissoryNote.findUnique({ where: { id: ids[0] }, omit: PROMISSORY_COMPAT_OMIT });
      if (!note) {
        return new Response("Nota promissória não encontrada.", { status: 404, headers });
      }
      if (note.status === "cancelada") {
        return new Response("Nota cancelada não pode ser impressa.", { status: 409, headers });
      }
      const bytes = await promissoryPdf(promissoryRowToPdfInput(note));
      return new Response(Buffer.from(bytes), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="garagem-promissoria-${note.number}.pdf"`,
        },
      });
    }

    const notes = await prisma.promissoryNote.findMany({
      omit: PROMISSORY_COMPAT_OMIT,
      where: { id: { in: ids } },
      orderBy: [{ number: "asc" }],
    });
    if (notes.length !== ids.length) {
      return new Response("Nota promissória não encontrada.", { status: 404, headers });
    }
    if (notes.some((note) => note.status === "cancelada")) {
      return new Response("Nota cancelada não pode ser impressa.", { status: 409, headers });
    }

    const bytes = await promissoryBatchPdf(notes.map((note) => promissoryRowToPdfInput(note)));
    const firstNumber = notes[0].number;
    const lastNumber = notes[notes.length - 1].number;

    return new Response(Buffer.from(bytes), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="garagem-promissorias-${firstNumber}-a-${lastNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[admin/promissorias/[id]]", error);
    return new Response("Não foi possível gerar o PDF.", { status: 500, headers });
  }
}
