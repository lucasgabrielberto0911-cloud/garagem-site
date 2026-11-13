/** URLs de foto que o Playwright deve substituir pela fixture local. */

export const E2E_PHOTO_FIXTURE = "public/branding/placeholder-car.png";

export function isE2ePhotoStubUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const path = parsed.pathname;
  if (
    path.includes("/fotos/") ||
    path.includes("/api/fotos/") ||
    path.includes("/api/catalog-jpg/")
  ) {
    return true;
  }
  if (parsed.hostname.includes("supabase.co") && path.includes("/storage/")) {
    return true;
  }
  if (parsed.hostname.endsWith(".public.blob.vercel-storage.com")) {
    return true;
  }
  return false;
}
