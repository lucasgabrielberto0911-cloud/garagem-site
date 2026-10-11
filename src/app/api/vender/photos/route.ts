import { NextResponse } from "next/server";
import { SNIFFED_EXTENSION, sniffImageType } from "@/lib/image-sniff";
import { checkVenderPhotoRateLimit } from "@/lib/rate-limit";
import {
  VEHICLE_DOCS_BUCKET,
  ensurePrivateDocsBucket,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
  privateFileRef,
} from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_SIZE = 4 * 1024 * 1024;
function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  const limited = await checkVenderPhotoRateLimit(clientKey(request));
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `Muitos envios. Tente de novo em ${limited.retryAfterSec}s.`,
      },
      { status: 429 },
    );
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "Upload indisponível no momento. Envie as fotos pelo WhatsApp." },
      { status: 503 },
    );
  }

  if (!hasSupabaseServiceRole()) {
    return NextResponse.json(
      { error: "Upload indisponível no momento. Envie as fotos pelo WhatsApp." },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Nenhuma foto enviada." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Foto muito grande. Máximo 4 MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = sniffImageType(buffer);
    if (!contentType) {
      return NextResponse.json(
        { error: "Use JPG, PNG ou WEBP." },
        { status: 400 },
      );
    }

    const path = `vender/${Date.now()}-${crypto.randomUUID()}.${SNIFFED_EXTENSION[contentType]}`;
    await ensurePrivateDocsBucket();
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.storage
      .from(VEHICLE_DOCS_BUCKET)
      .upload(path, buffer, {
        contentType,
        upsert: false,
        cacheControl: "private, max-age=60",
      });

    if (error) {
      console.error("[vender/photos] upload:", error);
      return NextResponse.json(
        { error: "Não foi possível enviar a foto. Tente de novo." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: privateFileRef(path) });
  } catch (error) {
    console.error("[vender/photos]", error);
    return NextResponse.json(
      { error: "Não foi possível enviar a foto. Tente de novo." },
      { status: 500 },
    );
  }
}
