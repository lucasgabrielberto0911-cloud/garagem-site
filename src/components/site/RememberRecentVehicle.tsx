"use client";

import { useEffect } from "react";
import { rememberRecentVehicle } from "@/lib/recently-viewed";

export function RememberRecentVehicle({ id }: { id: string }) {
  useEffect(() => { rememberRecentVehicle(id); }, [id]);
  return null;
}
