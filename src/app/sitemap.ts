import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";
import { vehiclePath } from "@/lib/vehicle-slug";

const STATIC_ROUTES: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/estoque", changeFrequency: "daily", priority: 0.9 },
  { path: "/vender", changeFrequency: "monthly", priority: 0.8 },
  { path: "/sobre", changeFrequency: "yearly", priority: 0.5 },
  { path: "/contato", changeFrequency: "yearly", priority: 0.6 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacidade", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  let vehicles: {
    id: string;
    brand: string;
    model: string;
    version: string | null;
    yearModel: number;
    updatedAt: Date;
  }[] = [];
  try {
    vehicles = await prisma.vehicle.findMany({
      where: { status: { not: "vendido" } },
      select: {
        id: true,
        brand: true,
        model: true,
        version: true,
        yearModel: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  } catch (error) {
    console.error("[sitemap] falha ao listar veículos:", error);
  }

  return [
    ...STATIC_ROUTES.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...vehicles.map((vehicle) => ({
      url: absoluteUrl(vehiclePath(vehicle)),
      lastModified: vehicle.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
