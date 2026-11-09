import Script from "next/script";

/** Google Analytics 4 — Measurement ID da propriedade Garagem. */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "G-B1L2105B12";

export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          var gaCfg = {};
          try {
            var u = new URL(location.href);
            if ((u.searchParams.get('utm_source') || '').toLowerCase() === 'pwa') {
              u.searchParams.delete('utm_source');
              if ((u.searchParams.get('utm_medium') || '').toLowerCase() === 'homescreen') u.searchParams.delete('utm_medium');
              gaCfg.page_location = u.toString();
            }
          } catch (e) {}
          gtag('config', '${GA_MEASUREMENT_ID}', gaCfg);
        `}
      </Script>
    </>
  );
}
