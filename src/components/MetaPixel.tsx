import Script from "next/script";
import { MetaPixelRouteListener } from "@/components/MetaPixelRouteListener";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

/** Só dígitos — o ID entra no script inline. */
function pixelId() {
  return /^\d+$/.test(META_PIXEL_ID) ? META_PIXEL_ID : "";
}

function stubScript(id: string) {
  // Stub oficial do Pixel: enfileira init/PageView/eventos antes do fbevents.js.
  // Não baixa o script pesado aqui — isso fica no next/script afterInteractive.
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
 * Um único Pixel: stub imediato (fila) + fbevents.js async.
 * ViewContent/Lead/Search não se perdem se o React disparar antes do download.
 */
export function MetaPixel() {
  const id = pixelId();
  if (!id) return null;

  return (
    <>
      <script
        id="meta-pixel-stub"
        dangerouslySetInnerHTML={{ __html: stubScript(id) }}
      />
      <Script
        id="meta-pixel-fbevents"
        src="https://connect.facebook.net/en_US/fbevents.js"
        strategy="afterInteractive"
      />
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1" />`,
        }}
      />
      <MetaPixelRouteListener />
    </>
  );
}
