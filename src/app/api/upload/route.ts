import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/auth";
import { blurDetectedPlates } from "@/lib/blur-plates";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
} from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SIZE = 15 * 1024 * 1024;
const MAX_EDGE = 1600;
const WEBP_QUALITY = 72;

type Detected = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/heic";

function detectMime(buffer: Buffer): Detected | null {
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

async function toProcessableBuffer(
  buffer: Buffer,
  detected: Detected,
): Promise<{ buffer: Buffer; detected: Detected }> {
  if (detected !== "image/heic") {
    return { buffer, detected };
  }

  const convert = (await import("heic-convert")).default;
  const jpeg = await convert({ buffer, format: "JPEG", quality: 0.9 });
  return { buffer: Buffer.from(jpeg), detected: "image/jpeg" };
}

/**
 * Normaliza qualquer formato aceito para WebP leve (redimensiona + comprime).
 * HEIC já deve ter sido convertido antes (ver toProcessableBuffer).
 */
async function optimizeForStorage(
  buffer: Buffer,
): Promise<{ buffer: Buffer; contentType: "image/webp"; extension: "webp" }> {
  const optimized = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer();

  return {
    buffer: optimized,
    contentType: "image/webp",
    extension: "webp",
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
          "Upload indisponível: falta SUPABASE_SERVICE_ROLE_KEY no Vercel (Supabase → Settings → API → service_role).",
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
          {
            error: `Arquivo muito grande: ${file.name}. Máximo 15 MB.`,
          },
          { status: 400 },
        );
      }

      const raw = Buffer.from(await file.arrayBuffer());
      const detected = detectMime(raw);
      if (!detected) {
        return NextResponse.json(
          {
            error: `Arquivo inválido: ${file.name}. Use JPG, PNG, WEBP, GIF ou HEIC.`,
          },
          { status: 400 },
        );
      }

      let prepared: {
        buffer: Buffer;
        contentType: "image/webp";
        extension: "webp";
      };
      try {
        // 1) HEIC → JPEG (se preciso), 2) blur de placa na resolução alta,
        // 3) só então redimensiona/comprime para o Storage.
        const processable = await toProcessableBuffer(raw, detected);
        const withPlatesBlurred = await blurDetectedPlates(processable.buffer);
        prepared = await optimizeForStorage(withPlatesBlurred);
      } catch (error) {
        console.error("Image optimize error:", error);
        return NextResponse.json(
          {
            error:
              detected === "image/heic"
                ? `Não foi possível converter o HEIC ${file.name}. Exporte como JPG no iPhone (Formatos → Mais Compatível).`
                : `Não foi possível otimizar ${file.name}.`,
          },
          { status: 400 },
        );
      }

      const path = `${Date.now()}-${crypto.randomUUID()}.${prepared.extension}`;

      const { error } = await supabase.storage
        .from(VEHICLE_PHOTOS_BUCKET)
        .upload(path, prepared.buffer, {
          contentType: prepared.contentType,
          upsert: false,
          cacheControl: "31536000",
        });

      if (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
          { error: error.message || "Falha no upload para o Storage." },
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
    const message =
      error instanceof Error && /Body exceeded|Entity Too Large|413/i.test(error.message)
        ? "Arquivo grande demais para o servidor. O admin agora envia direto ao Storage — atualize a página e tente de novo com JPG."
        : "Erro ao processar upload.";
    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && /413|Too Large/i.test(error.message) ? 413 : 500 },
    );
  }
}
