import { servePublicPhoto } from "@/lib/public-photo-http";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return servePublicPhoto(request, (await params).path);
}

export const HEAD = GET;
