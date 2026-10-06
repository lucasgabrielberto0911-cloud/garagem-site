import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { salesSearchWhere } from "@/lib/admin-sales-search";
import { normalizeAdminSearch, vehicleGlobalWhere, customerGlobalWhere, leadGlobalWhere, SEARCH_LIMIT, type AdminSearchGroup } from "@/lib/admin-global-search";

export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({}, { status: 401 });
  const query = normalizeAdminSearch(request.nextUrl.searchParams.get("q"));
  const headers = { "Cache-Control": "private, no-store" };
  if (query.length < 2) return NextResponse.json({ query, groups: [] }, { headers });
  try {
    const take = SEARCH_LIMIT + 1;
    const [vehicles, sales, customers, leads] = await Promise.all([
      prisma.vehicle.findMany({ where: vehicleGlobalWhere(query), take, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], select: { id: true, brand: true, model: true, version: true, yearModel: true, plate: true, status: true } }),
      prisma.sale.findMany({ where: salesSearchWhere(query), take, orderBy: [{ saleDate: "desc" }, { id: "asc" }], select: { id: true, saleDate: true, customer: { select: { name: true } }, vehicle: { select: { brand: true, model: true, plate: true } } } }),
      prisma.customer.findMany({ where: customerGlobalWhere(query), take, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, phone: true } }),
      prisma.leadVenda.findMany({ where: leadGlobalWhere(query), take, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, name: true, vehicleInfo: true, phone: true } }),
    ]);
    const suffix = `?q=${encodeURIComponent(query)}`;
    const groups: AdminSearchGroup[] = [
      { kind: "veiculos", label: "Veículos", href: `/admin/veiculos${suffix}`, more: vehicles.length > SEARCH_LIMIT, items: vehicles.slice(0, SEARCH_LIMIT).map(v => ({ id: v.id, title: `${v.brand} ${v.model}`, detail: [v.version, v.yearModel, v.plate, v.status === "vendido" ? "Vendido" : null].filter(Boolean).join(" · "), href: `/admin/veiculos/${encodeURIComponent(v.id)}` })) },
      { kind: "vendas", label: "Vendas", href: `/admin/vendas${suffix}`, more: sales.length > SEARCH_LIMIT, items: sales.slice(0, SEARCH_LIMIT).map(s => ({ id: s.id, title: `${s.vehicle.brand} ${s.vehicle.model}`, detail: [s.vehicle.plate, s.customer?.name, new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(s.saleDate)].filter(Boolean).join(" · "), href: `/admin/vendas?venda=${encodeURIComponent(s.id)}` })) },
      { kind: "clientes", label: "Clientes", href: `/admin/clientes${suffix}`, more: customers.length > SEARCH_LIMIT, items: customers.slice(0, SEARCH_LIMIT).map(c => ({ id: c.id, title: c.name, detail: c.phone, href: `/admin/clientes?cliente=${encodeURIComponent(c.id)}` })) },
      { kind: "contatos", label: "Contatos", href: `/admin/leads${suffix}`, more: leads.length > SEARCH_LIMIT, items: leads.slice(0, SEARCH_LIMIT).map(l => ({ id: l.id, title: l.name, detail: [l.vehicleInfo, l.phone].filter(Boolean).join(" · "), href: `/admin/leads?lead=${encodeURIComponent(l.id)}` })) },
    ];
    return NextResponse.json({ query, groups }, { headers });
  } catch (error) {
    console.error("[admin/busca]", error);
    return NextResponse.json({ error: "Não foi possível buscar. Tente novamente." }, { status: 500, headers });
  }
}
