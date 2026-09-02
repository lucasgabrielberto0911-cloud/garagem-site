"use client";

import { BackToTop } from "@/components/site/BackToTop";
import { InstallPrompt } from "@/components/site/InstallPrompt";
import { PwaRegister } from "@/components/site/PwaRegister";

/**
 * Chrome que pode esperar o idle: um chunk só, importado em DeferredMarketing.
 */
export function SiteExtras() {
  return (
    <>
      <BackToTop />
      <InstallPrompt />
      <PwaRegister />
    </>
  );
}
