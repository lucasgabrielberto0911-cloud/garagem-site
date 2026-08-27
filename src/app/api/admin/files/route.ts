import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  VEHICLE_DOCS_BUCKET,
  ensurePrivateDocsBucket,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
  privateFileRef,
} from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SIZE = 12 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function extensionFromName(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "Upload indisponível: configure o Supabase no Vercel." },
      { status: 503 },
    );
  }

  if (!hasSupabaseServiceRole()) {
    return NextResponse.json(
      { error: "Upload indisponível: falta SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo 12 MB." },
        { status: 400 },
      );
    }

    const mime = (file.type || "").toLowerCase();
    const fromName = extensionFromName(file.name);
    const extension =
      ALLOWED[mime] ||
      (fromName === "pdf" || fromName === "jpg" || fromName === "jpeg" || fromName === "png" || fromName === "webp"
        ? fromName === "jpeg"
          ? "jpg"
          : fromName
        : null);

    if (!extension) {
      return NextResponse.json(
        { error: "Use PDF, JPG, PNG ou WEBP." },
        { status: 400 },
      );
    }

    const contentType =
      extension === "pdf"
        ? "application/pdf"
        : extension === "png"
          ? "image/png"
          : extension === "webp"
            ? "image/webp"
            : "image/jpeg";

    const vehicleIdRaw = String(formData.get("vehicleId") || "").trim();
    const vehicleId = /^[a-zA-Z0-9_-]{8,40}$/.test(vehicleIdRaw)
      ? vehicleIdRaw
      : null;
    const path = vehicleId
      ? `${vehicleId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
      : `${Date.now()}-${crypto.randomUUID()}.${extension}`;

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
      console.error("[admin/files] upload:", error);
      return NextResponse.json(
        { error: error.message || "Falha no upload." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      url: privateFileRef(path),
      name: file.name,
    });
  } catch (error) {
    console.error("[admin/files]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao enviar arquivo.",
      },
      { status: 500 },
    );
  }
}
