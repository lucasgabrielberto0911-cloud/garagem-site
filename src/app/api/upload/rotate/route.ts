import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createPhotoMasterId, galleryStemFromStoragePath, masterObjectPathFromGalleryPath, previousObjectPathFromGalleryPath } from "@/lib/photo-master";
import { downloadPrivateMaster, uploadPrivateMasterBytes } from "@/lib/photo-master-store";
import { encodeMasterJpeg, toDownloadJpeg } from "@/lib/photo-jpeg";
import { parsePhotoRotation, rotatePhoto } from "@/lib/photo-rotation";
import { cardObjectPath, encodeCardImage, encodeGalleryImage } from "@/lib/image-variants";
import { getSupabaseAdmin, hasSupabaseServiceRole, VEHICLE_PHOTOS_BUCKET, VEHICLE_DOCS_BUCKET } from "@/lib/supabase";
export const runtime = "nodejs";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store" };

function ownPhotoPath(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const prefix = `/storage/v1/object/public/${VEHICLE_PHOTOS_BUCKET}/`;
    if (url.protocol !== "https:" || url.origin !== base.origin || url.search || url.hash || !url.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    return !path.includes("/") && galleryStemFromStoragePath(path) ? path : null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({}, { status: 401, headers });
  if (!hasSupabaseServiceRole()) return NextResponse.json({ error: "Fotos indisponíveis." }, { status: 503, headers });
  const path = ownPhotoPath(request.nextUrl.searchParams.get("url"));
  if (!path) return NextResponse.json({ error: "Foto inválida." }, { status: 400, headers });
  try {
    const previousPath = previousObjectPathFromGalleryPath(path);
    if (request.nextUrl.searchParams.get("preview") === "1") {
      const bytes = previousPath ? await downloadPrivateMaster(previousPath) : null;
      if (!bytes) return NextResponse.json({ error: "Versão anterior indisponível." }, { status: 404, headers });
      return new NextResponse(Buffer.from(bytes), { headers: { ...headers, "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff" } });
    }
    const { data: hasPrevious } = previousPath
      ? await getSupabaseAdmin().storage.from(VEHICLE_DOCS_BUCKET).exists(previousPath)
      : { data: false };
    return NextResponse.json({ hasPrevious }, { headers });
  } catch { return NextResponse.json({ error: "Não foi possível conferir a versão anterior." }, { status: 500, headers }); }
}

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({}, { status: 401, headers });
  if (!hasSupabaseServiceRole()) return NextResponse.json({ error: "Fotos indisponíveis." }, { status: 503, headers });
  let galleryPath: string | null = null;
  let cardPath: string | null = null;
  let id: string | null = null;
  try {
    const body = await request.json();
    const sourcePath = ownPhotoPath(body?.url);
    const degrees = parsePhotoRotation(body?.degrees);
    const restore = body?.restore === true;
    if (!sourcePath || (!restore && !degrees)) return NextResponse.json({ error: "Foto ou rotação inválida." }, { status: 400, headers });
    const supabase = getSupabaseAdmin();
    const sourceMaster = masterObjectPathFromGalleryPath(sourcePath);
    let current = sourceMaster ? await downloadPrivateMaster(sourceMaster) : null;
    if (!current) {
      const { data, error } = await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).download(sourcePath);
      if (error || !data) throw new Error("source");
      current = new Uint8Array(await data.arrayBuffer());
    }
    const previousPath = previousObjectPathFromGalleryPath(sourcePath);
    const previous = restore && previousPath ? await downloadPrivateMaster(previousPath) : null;
    if (restore && !previous) return NextResponse.json({ error: "Versão anterior indisponível. A foto atual foi mantida." }, { status: 409, headers });
    const processed = Buffer.from(restore ? previous! : await rotatePhoto(current, degrees!));
    const [gallery, card, master, backup] = await Promise.all([
      encodeGalleryImage(processed), encodeCardImage(processed), restore ? toDownloadJpeg(processed) : encodeMasterJpeg(processed), toDownloadJpeg(current),
    ]);
    id = createPhotoMasterId(); galleryPath = `${id}.${gallery.extension}`; cardPath = cardObjectPath(galleryPath);
    // Só retorna a nova foto se as duas versões privadas estiverem guardadas.
    const originals = await Promise.all([uploadPrivateMasterBytes(id, master), uploadPrivateMasterBytes(`${id}-previous`, backup)]);
    if (originals.some(ok => !ok)) throw new Error("backup");
    const uploads = await Promise.all([
      supabase.storage.from(VEHICLE_PHOTOS_BUCKET).upload(galleryPath, gallery.buffer, { contentType: gallery.contentType, upsert: false, cacheControl: "31536000" }),
      supabase.storage.from(VEHICLE_PHOTOS_BUCKET).upload(cardPath, card.buffer, { contentType: card.contentType, upsert: false, cacheControl: "31536000" }),
    ]);
    if (uploads.some(result => result.error)) throw new Error("upload");
    return NextResponse.json({ url: supabase.storage.from(VEHICLE_PHOTOS_BUCKET).getPublicUrl(galleryPath).data.publicUrl, thumbnailUrl: supabase.storage.from(VEHICLE_PHOTOS_BUCKET).getPublicUrl(cardPath).data.publicUrl }, { headers });
  } catch (error) {
    if (id) {
      const storage = getSupabaseAdmin().storage;
      await Promise.allSettled([
        storage.from(VEHICLE_PHOTOS_BUCKET).remove([galleryPath, cardPath].filter((path): path is string => Boolean(path))),
        storage.from(VEHICLE_DOCS_BUCKET).remove([`${id}.webp`].flatMap(path => [masterObjectPathFromGalleryPath(path), previousObjectPathFromGalleryPath(path)]).filter((path): path is string => Boolean(path))),
      ]);
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers });
    console.error("[upload/rotate]", error);
    return NextResponse.json({ error: "Não foi possível alterar a foto. A versão atual foi mantida." }, { status: 500, headers });
  }
}
