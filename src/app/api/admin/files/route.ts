import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/admin-request-origin";
import {
  VEHICLE_DOCS_BUCKET,
  ensurePrivateDocsBucket,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
  privateFileRef,
} from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const headers = { "Cache-Control": "private, no-store" };
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
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "Upload indisponível: configure o Supabase no Vercel." },
      { status: 503, headers },
    );
  }

  if (!hasSupabaseServiceRole()) {
    return NextResponse.json(
      { error: "Upload indisponível: falta SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503, headers },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400, headers });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo 12 MB." },
        { status: 400, headers },
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
        { status: 400, headers },
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

    const bucket = await ensurePrivateDocsBucket();
    if (bucket && bucket.public) {
      return NextResponse.json(
        { error: "Armazenamento privado indisponível." },
        { status: 503, headers },
      );
    }
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
        { error: "Não foi possível enviar o arquivo. Tente novamente." },
        { status: 500, headers },
      );
    }

    return NextResponse.json({
      url: privateFileRef(path),
      name: file.name,
    }, { headers });
  } catch (error) {
    console.error("[admin/files]", error);
    return NextResponse.json(
      {
        error: "Não foi possível enviar o arquivo. Tente novamente.",
      },
      { status: 500, headers },
    );
  }
}
