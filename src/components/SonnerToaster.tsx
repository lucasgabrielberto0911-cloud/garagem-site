"use client";

import { useEffect } from "react";
import { Toaster as Sonner } from "sonner";
import { signalToasterReady } from "@/lib/notify";

export function SonnerToaster() {
  useEffect(() => {
    signalToasterReady();
  }, []);

  return (
    <Sonner
      theme="dark"
      position="top-center"
      offset="max(0.75rem, env(safe-area-inset-top, 0px))"
      toastOptions={{
        style: {
          background: "#17171A",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#F7F5F2",
        },
      }}
    />
  );
}
