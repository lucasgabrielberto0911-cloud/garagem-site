import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordAdminAudit } from "@/lib/admin-audit";
import { scheduleAfterSale } from "@/lib/after-sale";
import { prisma } from "@/lib/prisma";
import { revalidatePublicStock } from "@/lib/public-stock-revalidate";
import { parseAdminSellInput } from "@/lib/admin-sell";
import { resolveBuyer } from "@/lib/sale-flow";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, message: "Não autorizado." },
      { status: 401, headers },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Dados da venda inválidos." },
      { status: 400, headers },
    );
  }
  const parsed = parseAdminSellInput(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400, headers },
    );
  }

  const { id } = await params;
  const saleDate = new Date();
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${id} FOR UPDATE`;
      const vehicle = await tx.vehicle.findUnique({
        where: { id },
        select: { id: true, status: true, historical: true },
      });
      if (!vehicle) throw new Error("VEHICLE_NOT_FOUND");
      if (vehicle.historical || vehicle.status === "vendido") {
        throw new Error("VEHICLE_UNAVAILABLE");
      }
      if (await tx.sale.findUnique({ where: { vehicleId: id }, select: { id: true } })) {
        throw new Error("VEHICLE_UNAVAILABLE");
      }

      const reservation = await tx.vehicleReservation.findFirst({
        where: { vehicleId: id, status: { in: ["ativa", "convertida"] } },
        orderBy: { createdAt: "desc" },
        include: { customer: true },
      });
      if (reservation && Number(reservation.deposit) > 0) {
        throw new Error("RESERVATION_SIGNAL_REQUIRED");
      }

      let saleId: string | undefined;
      if (parsed.mode === "complete") {
        // Mesma regra de cliente do assistente (resolveBuyer): reserva manda no comprador, telefone/CPF repetido não duplica.
        const buyerPhone = parsed.input.buyerPhone;
        const sameAsReservation = reservation
          ? reservation.customer.name === parsed.input.buyerName &&
            reservation.customer.phone.replace(/\D/g, "") === buyerPhone
          : false;
        const existingCustomer = reservation
          ? null
          : await tx.customer.findFirst({
              where: { phone: buyerPhone },
              select: { id: true, name: true },
            });
        const customer = await resolveBuyer(tx, {
          customerId: sameAsReservation
            ? reservation!.customerId
            : existingCustomer && existingCustomer.name === parsed.input.buyerName
              ? existingCustomer.id
              : "novo",
          customerName: parsed.input.buyerName,
          customerPhone: buyerPhone,
          cpf: "",
          rg: "",
          address: undefined,
          reservationCustomerId: reservation?.customerId,
          hasReservation: Boolean(reservation),
        });
        const customerId = customer.id;

        const sale = await tx.sale.create({
          data: {
            vehicleId: id,
            customerId,
            salePrice: parsed.input.salePrice,
            paymentMethod: parsed.input.paymentMethod,
            notes: parsed.input.notes ?? null,
            saleDate,
          },
          select: { id: true, customerId: true, saleDate: true, salePrice: true },
        });
        saleId = sale.id;
        await scheduleAfterSale(tx, sale);
        await recordAdminAudit(tx, session.adminId, sale.id, "sale.create", {
          salePrice: sale.salePrice,
          vehicleId: id,
        });
      }

      await tx.vehicleReservation.updateMany({
        where: { vehicleId: id, status: "ativa" },
        data: { status: "convertida" },
      });
      await tx.vehicle.update({
        where: { id },
        data: { status: "vendido", featured: false },
      });
      if (parsed.mode === "simple") {
        await recordAdminAudit(tx, session.adminId, id, "vehicle.status", {
          status: { before: vehicle.status, after: "vendido" },
          saleMode: "simples",
        });
      }
      return { saleId };
    });

    await revalidatePublicStock(id, undefined, "route-handler");
    const complete = parsed.mode === "complete";
    if (complete) {
      revalidatePath("/admin/vendas");
      revalidatePath("/admin/agenda");
      revalidatePath("/admin/clientes");
      revalidatePath("/admin");
    }
    revalidatePath("/admin/veiculos");
    revalidatePath(`/admin/veiculos/${id}`);

    return NextResponse.json(
      {
        ok: true,
        message: complete
          ? "Venda registrada e veículo marcado como vendido."
          : "Veículo marcado como vendido sem registro de venda.",
        ...(result.saleId ? { saleId: result.saleId } : {}),
      },
      { headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "VEHICLE_NOT_FOUND" ? 404 :
      ["VEHICLE_UNAVAILABLE", "RESERVATION_CUSTOMER", "RESERVATION_SIGNAL_REQUIRED", "DUPLICATE_CUSTOMER"].includes(message) ? 409 : 500;
    const errorMessage = message === "VEHICLE_NOT_FOUND"
      ? "Veículo não encontrado."
      : message === "RESERVATION_CUSTOMER"
        ? "A venda deve usar os dados do cliente da reserva."
        : message === "RESERVATION_SIGNAL_REQUIRED"
          ? "A reserva tem sinal. Abrindo o assistente de venda para concluir."
        : message === "DUPLICATE_CUSTOMER"
          ? "Já existe um cliente com este telefone em outro nome. Abrindo o assistente de venda para escolher o cadastro certo."
          : status === 409
            ? "Este veículo já foi vendido ou tem uma venda registrada."
            : parsed.mode === "complete"
              ? "Não foi possível registrar a venda."
              : "Não foi possível marcar o veículo como vendido.";
    if (status === 500) console.error("[api/admin/vehicles/[id]/sell] falha ao registrar venda");
    const needsFullFlow = message === "RESERVATION_SIGNAL_REQUIRED" || message === "DUPLICATE_CUSTOMER";
    return NextResponse.json(
      { ok: false, message: errorMessage, ...(needsFullFlow ? { nextUrl: `/admin/vendas/nova?veiculo=${encodeURIComponent(id)}` } : {}) },
      { status, headers },
    );
  }
}
