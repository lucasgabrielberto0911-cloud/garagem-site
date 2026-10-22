import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SaleFlow } from "@/components/admin/SaleFlow";

export const dynamic = "force-dynamic";

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ veiculo?: string; cliente?: string }> }) {
  if (!(await getSession())) redirect("/admin/login");
  const params = await searchParams;
  const [vehicle, customer] = await Promise.all([
    params.veiculo ? prisma.vehicle.findUnique({ where: { id: params.veiculo }, include: { reservations: { where: { status: "ativa", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 1, include: { customer: true } } } }) : null,
    params.cliente ? prisma.customer.findUnique({ where: { id: params.cliente } }) : null,
  ]);
  const reservedCustomer = vehicle?.reservations[0]?.customer;
  const selectedCustomer = customer ?? (reservedCustomer ? { id: reservedCustomer.id, name: reservedCustomer.name, phone: reservedCustomer.phone, cpf: reservedCustomer.cpf, rg: reservedCustomer.rg, address: reservedCustomer.address } : null);
  return <SaleFlow initialVehicle={vehicle ? { id: vehicle.id, label: `${vehicle.brand} ${vehicle.model} ${vehicle.yearModel}`, price: vehicle.price, status: vehicle.status, chassis: vehicle.chassis, renavam: vehicle.renavam, reservation: vehicle.reservations[0] ? { customerId: vehicle.reservations[0].customerId, customerName: vehicle.reservations[0].customer.name, deposit: Number(vehicle.reservations[0].deposit) } : null } : null} initialCustomer={selectedCustomer ? { id: selectedCustomer.id, label: `${selectedCustomer.name} · ${selectedCustomer.phone}`, name: selectedCustomer.name, phone: selectedCustomer.phone, cpf: selectedCustomer.cpf ?? "", rg: selectedCustomer.rg ?? "", address: selectedCustomer.address ?? "" } : null} />;
}
