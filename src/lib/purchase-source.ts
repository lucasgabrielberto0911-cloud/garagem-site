import { prisma } from "@/lib/prisma";
import { newPurchaseInput, PurchaseError, type PurchaseInput } from "./purchase-input";

/** DTO mínimo: nunca consulta Customer, fotos, telefone ou documentos. */
export async function findPurchaseSources(plate: string) {
  const normalized = plate.toUpperCase().replace(/[-\s]/g, "");
  if (!/^[A-Z]{3}(?:\d{4}|\d[A-Z]\d{2})$/.test(normalized)) throw new PurchaseError("Informe uma placa brasileira válida.");
  const [vehicles, leads] = await Promise.all([
    prisma.vehicle.findMany({ where: { plate: normalized }, take: 10, select: { id: true, brand: true, model: true, version: true, yearModel: true } }),
    prisma.leadVenda.findMany({ where: { plate: normalized }, take: 10, select: { id: true, vehicleInfo: true } }),
  ]);
  return [...vehicles.map(v => ({ kind: "vehicle" as const, id: v.id, title: `${v.brand} ${v.model} ${v.version ?? ""} ${v.yearModel}` })), ...leads.map(l => ({ kind: "lead" as const, id: l.id, title: l.vehicleInfo }))];
}
export async function loadPurchaseSource(source: NonNullable<PurchaseInput["source"]>) {
  const input = newPurchaseInput();
  if (source.kind === "vehicle") {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: source.id }, select: { brand: true, model: true, version: true, yearModel: true, fuel: true, transmission: true, km: true, plate: true } });
    if (!vehicle) throw new PurchaseError("Origem não encontrada.", 404);
    input.title = `${vehicle.brand} ${vehicle.model} ${vehicle.version ?? ""} ${vehicle.yearModel}`.slice(0, 160);
    input.identity = { brand: vehicle.brand, model: vehicle.model, version: vehicle.version ?? "", modelYear: vehicle.yearModel, fuel: vehicle.fuel, transmission: vehicle.transmission, confirmed: false };
    input.plate = vehicle.plate ?? ""; input.km = vehicle.km;
  } else {
    const lead = await prisma.leadVenda.findUnique({ where: { id: source.id }, select: { vehicleInfo: true, plate: true, km: true } });
    if (!lead) throw new PurchaseError("Origem não encontrada.", 404);
    input.title = lead.vehicleInfo.slice(0, 160); input.plate = lead.plate; input.km = lead.km;
  }
  input.source = source;
  return input;
}
