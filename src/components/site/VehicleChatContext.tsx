"use client";

import { useEffect } from "react";
import {
  setChatVehicleContext,
  type ChatVehicleContext,
} from "@/lib/chat-vehicle-context";

export function VehicleChatContext({ vehicle }: { vehicle: ChatVehicleContext }) {
  useEffect(() => {
    setChatVehicleContext(vehicle);
    return () => {
      setChatVehicleContext(null);
    };
  }, [vehicle]);

  return null;
}
