"use client";

import { BootSplash } from "@/components/site/BootSplash";
import { ScrollProgress } from "@/components/site/ScrollProgress";
import { BackToTop } from "@/components/site/BackToTop";
import { InstallPrompt } from "@/components/site/InstallPrompt";

/** Chrome secundário carregado após load e ocioso. */
export function SiteExtras() {
  return (
    <>
      <BootSplash />
      <ScrollProgress />
      <BackToTop />
      <InstallPrompt />
    </>
  );
}
