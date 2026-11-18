"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  CONSENT_EVENT,
  hasMarketingConsent,
  readStoredConsent,
  rememberAdVisit,
  shouldLoadMetaPixel,
  type ConsentChoice,
} from "@/lib/consent";

const GoogleAnalytics = dynamic(
  () => import("@/components/GoogleAnalytics").then((mod) => mod.GoogleAnalytics),
  { ssr: false },
);

const MetaPixel = dynamic(
  () => import("@/components/MetaPixel").then((mod) => mod.MetaPixel),
  { ssr: false },
);

/**
 * GA só com aceite. O Pixel sobe no aceite e no clique de anúncio (fbclid /
 * utm meta|facebook|fb|ig|instagram), mesmo com "só o essencial". O fbevents
 * entra afterInteractive.
 */
export function MarketingScripts() {
  const [analytics, setAnalytics] = useState(false);
  const [pixel, setPixel] = useState(false);

  useEffect(() => {
    function sync(next?: ConsentChoice | null) {
      const choice = next ?? readStoredConsent();
      const search = window.location.search;
      setAnalytics(hasMarketingConsent(choice));
      setPixel(shouldLoadMetaPixel(choice, search, rememberAdVisit(search)));
    }
    sync();
    function onConsent(event: Event) {
      sync((event as CustomEvent<ConsentChoice>).detail);
    }
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  if (!pixel && !analytics) return null;
  return (
    <>
      {pixel ? <MetaPixel /> : null}
      {analytics ? <GoogleAnalytics /> : null}
    </>
  );
}
