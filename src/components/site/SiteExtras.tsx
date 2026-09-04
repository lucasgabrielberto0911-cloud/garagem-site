"use client";

import { BackToTop } from "@/components/site/BackToTop";
import { InstallPrompt } from "@/components/site/InstallPrompt";

/**
 * Chrome que pode esperar o idle: um chunk só, importado em DeferredMarketing.
 * O SW registra no layout (PwaRegister) para a abertura do app não esperar.
 */
export function SiteExtras() {
  return (
    <>
      <BackToTop />
      <InstallPrompt />
    </>
  );
}
