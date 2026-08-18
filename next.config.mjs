/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Breakpoints alinhados a cards (50vw/33vw) e galeria (~60vw).
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vesmqhyxautgtvgccweo.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: [
      "heic-convert",
      "heic-decode",
      "libheif-js",
      "sharp",
    ],
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
    // URLs antigas de anúncios já apagados do banco (antes do fluxo "vendido").
    return [
      {
        source: "/honda-hrv-2020",
        destination: "/estoque",
        permanent: true,
      },
      {
        source: "/chevrolet-cruze-lt",
        destination: "/estoque",
        permanent: true,
      },
      {
        source: "/etios-xls-2018",
        destination: "/estoque",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
