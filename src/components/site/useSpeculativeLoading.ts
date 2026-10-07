"use client";

import { useSyncExternalStore } from "react";
import { allowsSpeculativeLoading, type ConnectionHints } from "@/lib/connection-policy";

type NetworkConnection = Pick<ConnectionHints, "saveData" | "effectiveType" | "downlink"> & Partial<EventTarget>;
function connection() {
  return (navigator as Navigator & { connection?: NetworkConnection }).connection;
}
function snapshot() {
  const network = connection();
  return allowsSpeculativeLoading({
    online: navigator.onLine,
    saveData: network?.saveData,
    effectiveType: network?.effectiveType,
    downlink: network?.downlink,
  });
}
function subscribe(changed: () => void) {
  const network = connection();
  window.addEventListener("online", changed);
  window.addEventListener("offline", changed);
  network?.addEventListener?.("change", changed);
  return () => {
    window.removeEventListener("online", changed);
    window.removeEventListener("offline", changed);
    network?.removeEventListener?.("change", changed);
  };
}
const serverSnapshot = () => false;
export function useSpeculativeLoading() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
