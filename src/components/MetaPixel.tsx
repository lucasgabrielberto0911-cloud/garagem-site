import Script from "next/script";
import { MetaPixelRouteListener } from "@/components/MetaPixelRouteListener";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

/** Só dígitos — o ID entra no script inline. */
function pixelId() {
  return /^\d+$/.test(META_PIXEL_ID) ? META_PIXEL_ID : "";
}

/**
 * Código-base do Meta Pixel (equivalente ao snippet oficial),
 * uma vez no layout raiz, via next/script.
 */
export function MetaPixel() {
  const id = pixelId();
  if (!id) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="lazyOnload">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${id}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height={1}
          width={1}
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
      <MetaPixelRouteListener />
    </>
  );
}
