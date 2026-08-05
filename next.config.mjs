/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vesmqhyxautgtvgccweo.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // heic-convert / libheif usam binários nativos; não empacotar no bundle do Next.
  experimental: {
    serverComponentsExternalPackages: [
      "heic-convert",
      "heic-decode",
      "libheif-js",
    ],
  },
};

export default nextConfig;
