import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expensesPdf } from "@/lib/commercial-pdf";
import { VEHICLE_COST_KINDS, costKindLabel } from "@/lib/vehicle-ops";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new Response("Sessão expirada.", { status: 401, headers });
  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { costs: true, sale: { select: { salePrice: true } } },
  });
  if (!vehicle) return new Response("Veículo não encontrado.", { status: 404, headers });
  const order = VEHICLE_COST_KINDS.map((item) => item.value as string);
  const rank = (kind: string) => (order.includes(kind) ? order.indexOf(kind) : order.length);
  try {
    const bytes = await expensesPdf({
      vehicle: [vehicle.brand, vehicle.model, vehicle.version, vehicle.yearModel ? `${vehicle.year}/${vehicle.yearModel}` : vehicle.year].filter(Boolean).join(" "),
      plate: vehicle.plate ?? undefined,
      consigned: vehicle.consigned,
      purchasePrice: vehicle.purchasePrice,
      salePrice: vehicle.sale?.salePrice ?? vehicle.price,
      sold: Boolean(vehicle.sale),
      costs: [...vehicle.costs]
        .sort((a, b) => rank(a.kind) - rank(b.kind))
        .map((cost) => ({ kind: cost.kind, description: cost.description, amount: cost.amount, date: cost.incurredAt.toISOString() })),
      kindLabel: costKindLabel,
    });
    return new Response(Buffer.from(bytes), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="garagem-gastos-${vehicle.id}.pdf"` } });
  } catch {
    return new Response("Não foi possível gerar o PDF.", { status: 500, headers });
  }
}
