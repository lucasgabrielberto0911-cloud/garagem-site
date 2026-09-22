import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { safeJpgDownloadName } from "@/lib/photo-archive";
import {
  attachmentHeaders,
  loadAdminJpeg,
  vehiclePhotoStoragePath,
} from "@/lib/photo-archive-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * JPG em alta da grade do anúncio (o id do banco ainda pode não existir).
 * Prefere o master privado. A URL pública não é buscada como se fosse aberta:
 * o path tem de ser do bucket de fotos, e a rota exige sessão de admin.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") ?? "";
  const storagePath = vehiclePhotoStoragePath(url);
  if (!storagePath) {
    return NextResponse.json(
      { error: "Só dá para baixar fotos do acervo do anúncio." },
      { status: 400 },
    );
  }

  const bytes = await loadAdminJpeg(url);
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
