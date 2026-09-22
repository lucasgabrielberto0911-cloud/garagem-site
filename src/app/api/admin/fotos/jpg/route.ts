import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { safeJpgDownloadName } from "@/lib/photo-archive";
import {
  attachmentHeaders,
  loadStorageJpeg,
  vehiclePhotoStoragePath,
} from "@/lib/photo-archive-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * JPG de uma foto da grade do anúncio (o id do banco ainda pode não existir).
 * Só objetos do bucket público de veículos — a URL não é buscada direto.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const storagePath = vehiclePhotoStoragePath(searchParams.get("url") ?? "");
  if (!storagePath) {
    return NextResponse.json(
      { error: "Só dá para baixar fotos do acervo do anúncio." },
      { status: 400 },
    );
  }

  const bytes = await loadStorageJpeg(storagePath);
  if (!bytes) {
    return NextResponse.json(
      { error: "Não foi possível preparar o JPG." },
      { status: 502 },
    );
  }

  const filename = safeJpgDownloadName(
    searchParams.get("name") || storagePath.split("/").pop(),
  );

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...attachmentHeaders(filename, "image/jpeg"),
      "Content-Length": String(bytes.byteLength),
    },
  });
}
