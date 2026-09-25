"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { MetaPixelRouteListener } from "@/components/MetaPixelRouteListener";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

/** Só dígitos — o ID entra no script inline. */
function pixelId() {
  return /^\d+$/.test(META_PIXEL_ID) ? META_PIXEL_ID : "";
}

function stubScript(id: string) {
  // Stub oficial do Pixel: enfileira init/PageView/eventos antes do fbevents.js.
  return `
    !function(f){if(f.fbq)return;var n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];}(window);
    fbq('init', '${id}');
    fbq('track', 'PageView');
  `;
}

/**
 * O pixel só entra depois do efeito de consentimento, no cliente. Um <script>
 * renderizado pelo React não executa nesse caminho: o fbevents.js sobe e
 * quebra com `fbq is not defined`. Criar o nó no DOM roda o stub antes.
 */
function installPixelStub(id: string) {
  if (window.fbq) return;
  document.getElementById("meta-pixel-stub")?.remove();
  const script = document.createElement("script");
  script.id = "meta-pixel-stub";
  script.text = stubScript(id);
  document.head.appendChild(script);
}

/**
 * Um único Pixel: stub executável + fbevents.js afterInteractive.
 * O idle esperava o load e o PageView da campanha não chegava (clique no
 * anúncio sem visualização). O GA4 continua adiado.
 */
export function MetaPixel() {
  const id = pixelId();
  const [stubReady, setStubReady] = useState(false);

  useEffect(() => {
    if (!id) return;
    installPixelStub(id);
    setStubReady(true);
  }, [id]);

  if (!id) return null;

  return (
    <>
      {stubReady ? (
        <Script
          id="meta-pixel-fbevents"
          src="https://connect.facebook.net/en_US/fbevents.js"
          strategy="afterInteractive"
        />
      ) : null}
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1" />`,
        }}
      />
      <MetaPixelRouteListener />
    </>
  );
}
