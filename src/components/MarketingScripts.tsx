"use client";

import { useEffect, useState } from "react";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { MetaPixel } from "@/components/MetaPixel";
import {
  CONSENT_EVENT,
  hasMarketingConsent,
  readStoredConsent,
  type ConsentChoice,
} from "@/lib/consent";

/** Pixel e GA só depois do consentimento de marketing. */
export function MarketingScripts() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    function sync(next?: ConsentChoice | null) {
      setAllowed(hasMarketingConsent(next ?? readStoredConsent()));
    }
    sync();
    function onConsent(event: Event) {
      sync((event as CustomEvent<ConsentChoice>).detail);
    }
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  if (!allowed) return null;
  return (
    <>
      <MetaPixel />
      <GoogleAnalytics />
    </>
  );
}
