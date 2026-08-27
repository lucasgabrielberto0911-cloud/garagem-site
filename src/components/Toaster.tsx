"use client";

import { Toaster as Sonner } from "sonner";

export function AppToaster() {
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
