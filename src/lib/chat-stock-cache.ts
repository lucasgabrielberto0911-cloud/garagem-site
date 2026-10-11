import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { VEHICLES_PUBLIC_CACHE_TAG } from "@/lib/vehicles";
import { loadChatStock } from "@/lib/chat-stock";
import type { ChatSoldVehicle } from "@/lib/chat-sold";

export const CHAT_SOLD_VEHICLE_SELECT = {
  id: true,
  brand: true,
  model: true,
  version: true,
  yearModel: true,
  category: true,
  transmission: true,
} as const;

const cacheOptions = { revalidate: 600, tags: [VEHICLES_PUBLIC_CACHE_TAG] };

export const loadCachedChatStock = unstable_cache(loadChatStock, ["chat-stock"], cacheOptions);

export async function loadChatSoldStock(): Promise<ChatSoldVehicle[]> {
  return prisma.vehicle.findMany({
    where: { status: "vendido" },
    select: CHAT_SOLD_VEHICLE_SELECT,
    orderBy: { id: "asc" },
  });
}

export const loadCachedChatSoldStock = unstable_cache(loadChatSoldStock, ["chat-sold-stock"], cacheOptions);
