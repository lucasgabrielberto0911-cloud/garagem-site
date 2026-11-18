import { NextResponse } from "next/server";
import {
  loadPhotoWithRetry,
  PHOTO_ZIP_BATCH_HEADER,
} from "@/lib/admin-photo-zip";
import { getSession } from "@/lib/auth";
import { safeJpgDownloadName } from "@/lib/photo-archive";
import {
  attachmentHeaders,
  loadAdminJpegDetailed,
  vehiclePhotoStoragePath,
} from "@/lib/photo-archive-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function statusFromFailureReason(reason: string): number {
  if (/n[aã]o\s+encontrad/i.test(reason)) return 404;
  if (/tempo\s+esgotado/i.test(reason)) return 504;
  return 502;
}

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
      {
        error: "Só dá para baixar fotos do acervo do anúncio.",
        reason: "Endereço fora do acervo",
      },
      { status: 400 },
    );
  }

  const isZipBatch = request.headers.get(PHOTO_ZIP_BATCH_HEADER) === "1";
  const outcome = await loadPhotoWithRetry(
    (signal) =>
      loadAdminJpegDetailed(url, {
        signal,
        timeoutMs: 8_000,
      }),
    {
      retries: isZipBatch ? 0 : 1,
      timeoutMs: 8_500,
    },
  );

  if (!outcome.ok) {
    return NextResponse.json(
      {
        error: `Não foi possível preparar o JPG (${outcome.reason}).`,
        reason: outcome.reason,
      },
      { status: statusFromFailureReason(outcome.reason) },
    );
  }

  const filename = safeJpgDownloadName(
    searchParams.get("name") || storagePath.split("/").pop(),
  );

  return new NextResponse(Buffer.from(outcome.bytes), {
    status: 200,
    headers: {
      ...attachmentHeaders(filename, "image/jpeg"),
      "Content-Length": String(outcome.bytes.byteLength),
    },
  });
}
