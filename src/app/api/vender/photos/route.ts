import { NextResponse } from "next/server";
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
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function extensionFromName(name: string) {
  const match = name.toLowerCase().match(/\.(jpe?g|png|webp)$/);
  if (!match) return "";
  return match[1] === "jpeg" ? "jpg" : match[1];
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

    const mime = (file.type || "").toLowerCase();
    const extension = ALLOWED[mime] || extensionFromName(file.name);
    if (!extension) {
      return NextResponse.json(
        { error: "Use JPG, PNG ou WEBP." },
        { status: 400 },
      );
    }

    const contentType =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : "image/jpeg";

    const path = `vender/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    await ensurePrivateDocsBucket();
    const supabase = getSupabaseAdmin();
    const buffer = Buffer.from(await file.arrayBuffer());

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
