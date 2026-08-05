import { NextResponse } from "next/server";
import convert from "heic-convert";
import { getSession } from "@/lib/auth";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
} from "@/lib/supabase";

const MAX_SIZE = 15 * 1024 * 1024;
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
function detectMime(buffer: Buffer): AllowedMime | "image/heic" | null {
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
  if (isHeicBuffer(buffer)) return "image/heic";
  return null;
}

/** HEIC/HEIF: box ISO BMFF com `ftyp` e brand heic/heif/mif1 etc. */
function isHeicBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  const boxSize = buffer.readUInt32BE(0);
  const end = Math.min(
    buffer.length,
    boxSize >= 8 && boxSize <= buffer.length ? boxSize : Math.min(buffer.length, 64),
  );
  const brands = buffer.toString("ascii", 8, end).toLowerCase();
  return /heic|heix|hevc|hevx|heim|heis|mif1|msf1/.test(brands);
}

async function toUploadable(
  buffer: Buffer,
  detected: AllowedMime | "image/heic",
): Promise<{ buffer: Buffer; mime: AllowedMime }> {
  if (detected !== "image/heic") {
    return { buffer, mime: detected };
  }

  // iPhone grava HEIC; convertemos para JPEG para o site abrir em qualquer navegador.
  const converted = await convert({
    buffer,
    format: "JPEG",
    quality: 0.9,
  });

  return {
    buffer: Buffer.from(converted),
    mime: "image/jpeg",
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return NextResponse.json(
      {
        error:
          "Upload indisponível: configure NEXT_PUBLIC_SUPABASE_URL no Vercel.",
      },
      { status: 503 },
    );
  }

  if (!hasSupabaseServiceRole()) {
    return NextResponse.json(
      {
        error:
          "Upload indisponível: falta SUPABASE_SERVICE_ROLE_KEY no Vercel (Supabase → Settings → API → service_role). Sem isso as fotos não gravam e o estoque fica sem imagem.",
      },
      { status: 503 },
    );
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

      const raw = Buffer.from(await file.arrayBuffer());
      const detected = detectMime(raw);
      if (!detected) {
        return NextResponse.json(
          {
            error: `Arquivo inválido ou tipo não suportado: ${file.name}. Use JPG, PNG, WEBP, GIF ou HEIC.`,
          },
          { status: 400 },
        );
      }

      let prepared: { buffer: Buffer; mime: AllowedMime };
      try {
        prepared = await toUploadable(raw, detected);
      } catch (error) {
        console.error("HEIC convert error:", error);
        return NextResponse.json(
          {
            error: `Não foi possível converter o HEIC ${file.name}. Tente exportar como JPG.`,
          },
          { status: 400 },
        );
      }

      const extension = ALLOWED[prepared.mime];
      const path = `${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { error } = await supabase.storage
        .from(VEHICLE_PHOTOS_BUCKET)
        .upload(path, prepared.buffer, {
          contentType: prepared.mime,
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
