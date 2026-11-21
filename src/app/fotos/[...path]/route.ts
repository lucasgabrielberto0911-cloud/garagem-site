import { servePublicPhoto } from "@/lib/public-photo-http";
import { getSiteContent } from "@/lib/site-content";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return servePublicPhoto(request, (await params).path, fetch, {
    isAllowedLegacyUpstream: async (upstream) => {
      const content = await getSiteContent();
      return Boolean(content.founderPhotoUrl && content.founderPhotoUrl === upstream);
    },
  });
}

export const HEAD = GET;
