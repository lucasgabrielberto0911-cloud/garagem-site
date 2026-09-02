/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactCompiler: true,
  compiler: {
    removeConsole: {
      exclude: ["error", "warn"],
    },
  },
  images: {
    // Um formato só: avif+webp duplicava cada foto na cota da Vercel.
    formats: ["image/webp"],
    // 96 = miniatura da galeria; 384 cobre card 50vw. Menos widths = menos transformações.
    deviceSizes: [640, 828, 1080],
    imageSizes: [96, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Cota Hobby de Image Optimization esgotada: /_next/image devolve 402
    // (OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED) e o estoque/galeria ficam
    // sem foto. Servir originais (Supabase + /branding) até upgrade de plano.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vesmqhyxautgtvgccweo.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "vesmqhyxautgtvgccweo.supabase.co",
        pathname: "/storage/v1/render/image/public/**",
      },
    ],
  },
  serverExternalPackages: [
    "heic-convert",
    "heic-decode",
    "libheif-js",
    "sharp",
  ],
  experimental: {
    optimizePackageImports: ["@aws-sdk/client-rekognition"],
  },
  async headers() {
    const immutable = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];
    return [
      { source: "/branding/:path*", headers: immutable },
      { source: "/icons/:path*", headers: immutable },
      { source: "/favicon.png", headers: immutable },
      { source: "/apple-touch-icon.png", headers: immutable },
      { source: "/og.png", headers: immutable },
    ];
  },
  async redirects() {
    // Anúncios apagados do banco (antes do fluxo "vendido").
    // statusCode 301 — `permanent: true` no Next vira 308. Em produção a
    // mesma lista está em vercel.json para a borda pegar também /url/.
    const retiredListings = [
      "/honda-hrv-2020",
      "/chevrolet-cruze-lt",
      "/etios-xls-2018",
    ];
    return retiredListings.flatMap((source) => [
      { source, destination: "/estoque", statusCode: 301 },
      { source: `${source}/`, destination: "/estoque", statusCode: 301 },
    ]);
  },
};

export default nextConfig;
