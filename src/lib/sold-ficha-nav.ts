/**
 * Links de navegação rápida da ficha de veículo vendido.
 * Nunca recebem nem devolvem preço: só marca, categoria e histórico da loja.
 */
export type SoldFichaNavLink = { href: string; label: string };

export function soldFichaNavLinks(vehicle: {
  brand: string;
  category?: string | null;
}): SoldFichaNavLink[] {
  const isMoto = vehicle.category === "moto";
  const brand = vehicle.brand.trim();
  const links: SoldFichaNavLink[] = [];
  if (brand) {
    const params = new URLSearchParams({ brand });
    if (isMoto) params.set("category", "moto");
    links.push({
      href: `/estoque?${params.toString()}`,
      label: `Outros ${brand} disponíveis`,
    });
  }
  links.push({
    href: isMoto ? "/estoque?category=moto" : "/estoque",
    label: isMoto ? "Ver outras motos disponíveis" : "Ver carros disponíveis",
  });
  links.push({ href: "/vendidos", label: "Ver entregas e histórico da loja" });
  return links;
}
