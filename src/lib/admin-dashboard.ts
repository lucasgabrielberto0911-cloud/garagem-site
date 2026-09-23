/** Pendências do dashboard em ordem de urgência — sem prisma, testável. */

export type DashboardAlertTone = "brand" | "warning" | "neutral";
export type DashboardAlertIcon = "alert" | "image" | "star" | "quote";

export type DashboardAlert = {
  key: string;
  tone: DashboardAlertTone;
  icon: DashboardAlertIcon;
  title: string;
  description: string;
  href: string;
};

type VehicleRef = { id: string; brand: string; model: string };

export type DashboardAlertsInput = {
  usingSeedPassword: boolean;
  withoutPhotos: VehicleRef[];
  noFeatured: boolean;
  staleVehicles: Array<VehicleRef & { days: number }>;
  staleDays: number;
  withoutVideo: VehicleRef[];
  placeholders: string[];
  noTestimonials: boolean;
  noGoogleReviews: boolean;
};

/** Quantas pendências aparecem antes do “Ver todas” no celular. */
export const DASHBOARD_ALERTS_VISIBLE = 4;

/**
 * Primeiro o que trava venda (senha, anúncio sem foto, vitrine vazia),
 * depois estoque parado, e por último ajustes de cadastro da loja.
 */
export function buildDashboardAlerts(input: DashboardAlertsInput): DashboardAlert[] {
  const list: DashboardAlert[] = [];

  if (input.usingSeedPassword) {
    list.push({
      key: "seed-password",
      tone: "brand",
      icon: "alert",
      title: "Senha padrão ainda em uso",
      description:
        "Um acesso do painel continua com a senha criada na instalação. Troque em Minha conta.",
      href: "/admin/conta",
    });
  }

  for (const vehicle of input.withoutPhotos) {
    list.push({
      key: `no-photo-${vehicle.id}`,
      tone: "brand",
      icon: "image",
      title: `${vehicle.brand} ${vehicle.model} sem fotos`,
      description: "Anúncios sem foto praticamente não recebem contato.",
      href: `/admin/veiculos/${vehicle.id}`,
    });
  }

  if (input.noFeatured) {
    list.push({
      key: "no-featured",
      tone: "warning",
      icon: "star",
      title: "Nenhum veículo em destaque",
      description:
        "Marque até 8 anúncios disponíveis. A home não escolhe carro sozinha — sem destaque, a vitrine fica vazia.",
      href: "/admin/veiculos?tab=destaques",
    });
  }

  for (const vehicle of input.staleVehicles) {
    list.push({
      key: `stale-${vehicle.id}`,
      tone: "neutral",
      icon: "alert",
      title: `${vehicle.brand} ${vehicle.model} há ${vehicle.days} dias no estoque`,
      description: `Parado há mais de ${input.staleDays} dias. Vale revisar preço ou fotos.`,
      href: `/admin/veiculos/${vehicle.id}`,
    });
  }

  if (input.withoutVideo.length > 0) {
    const [first] = input.withoutVideo;
    list.push({
      key: "no-video",
      tone: "neutral",
      icon: "alert",
      title:
        input.withoutVideo.length === 1
          ? `${first.brand} ${first.model} sem vídeo`
          : `${input.withoutVideo.length}+ anúncios sem vídeo`,
      description:
        "Marque no cadastro quando já tiver vídeo. O site continua com “Pedir vídeo” no WhatsApp.",
      href: "/admin/veiculos",
    });
  }

  if (input.placeholders.length > 0) {
    list.push({
      key: "placeholders",
      tone: "warning",
      icon: "alert",
      title: "Dados da loja incompletos",
      description: `Ainda em placeholder: ${input.placeholders.join(", ")}.`,
      href: "/admin/site",
    });
  }

  if (input.noTestimonials) {
    list.push({
      key: "no-testimonials",
      tone: "neutral",
      icon: "quote",
      title: "Nenhum depoimento publicado",
      description:
        "A home ainda usa depoimentos de exemplo. Publique os reais em Depoimentos.",
      href: "/admin/depoimentos",
    });
  }

  if (input.noGoogleReviews) {
    list.push({
      key: "no-google-reviews",
      tone: "neutral",
      icon: "star",
      title: "Selo do Google ainda oculto",
      description:
        "Preencha nota, quantidade e o link do perfil em Site. Sem isso o selo não aparece.",
      href: "/admin/site",
    });
  }

  return list;
}

export function splitDashboardAlerts<T>(list: T[], visible = DASHBOARD_ALERTS_VISIBLE) {
  const limit = Math.max(0, visible);
  return { head: list.slice(0, limit), rest: list.slice(limit) };
}
