import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { VEHICLE_PHOTOS_BUCKET, getSupabaseAdmin } from "@/lib/supabase";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

type AllowedMime = keyof typeof ALLOWED;

/**
 * Confere os magic bytes reais do arquivo. O `file.type` do browser é fácil de
 * forjar; o cabeçalho binário não.
 */
function detectMime(buffer: Buffer): AllowedMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 6) {
    const header = buffer.toString("ascii", 0, 6);
    if (header === "GIF87a" || header === "GIF89a") return "image/gif";
  }
  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);

    const single = formData.get("file");
    if (single instanceof File && single.size > 0) {
      files.push(single);
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado." },
        { status: 400 },
      );
    }

    if (files.length > 20) {
      return NextResponse.json(
        { error: "Envie no máximo 20 fotos por vez." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const urls: string[] = [];

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `Arquivo muito grande: ${file.name}` },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const mime = detectMime(buffer);
      if (!mime) {
        return NextResponse.json(
          { error: `Arquivo inválido ou tipo não suportado: ${file.name}` },
          { status: 400 },
        );
      }

      const extension = ALLOWED[mime];
      const path = `${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { error } = await supabase.storage
        .from(VEHICLE_PHOTOS_BUCKET)
        .upload(path, buffer, {
          contentType: mime,
          upsert: false,
        });

      if (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
          { error: error.message || "Falha no upload." },
          { status: 500 },
        );
      }

      const { data } = supabase.storage
        .from(VEHICLE_PHOTOS_BUCKET)
        .getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    return NextResponse.json({
      urls,
      url: urls[0],
    });
  } catch (error) {
    console.error("Upload route error:", error);
    return NextResponse.json(
      { error: "Erro ao processar upload." },
      { status: 500 },
    );
  }
}
