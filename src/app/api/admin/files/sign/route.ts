import { isSameOriginRequest } from "@/lib/admin-request-origin";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  VEHICLE_DOCS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
  ensurePrivateDocsBucket,
  privateFileRef,
} from "@/lib/supabase";

const headers = { "Cache-Control": "private, no-store" };

const types: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return NextResponse.json({}, { status: 403, headers });
  if (!(await getSession()))
    return NextResponse.json(
      { error: "Sessão expirada. Entre novamente e tente reenviar." },
      { status: 401, headers },
    );
  if (!hasSupabaseServiceRole())
    return NextResponse.json(
      { error: "Upload indisponível." },
      { status: 503, headers },
    );

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "JSON inválido." },
      { status: 400, headers },
    );
  }

  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400, headers },
    );
  }

  const body = rawBody as Record<string, unknown>;
  const type = typeof body.type === "string" ? body.type : "";
  const size = typeof body.size === "number" ? body.size : NaN;

  if (
    typeof types[type] !== "string" ||
    !Number.isInteger(size) ||
    size <= 0 ||
    size > 12 * 1024 * 1024
  ) {
    return NextResponse.json(
      { error: "Use PDF, JPG, PNG ou WEBP de até 12 MB." },
      { status: 400, headers },
    );
  }

  try {
    let bucket;
    try {
      bucket = await ensurePrivateDocsBucket();
    } catch (err) {
      console.error("[admin/files/sign] ensurePrivateDocsBucket:", err);
      return NextResponse.json(
        {
          error:
            "O armazenamento privado não está disponível para este tamanho de arquivo.",
        },
        { status: 503, headers },
      );
    }

    if (
      !bucket ||
      bucket.public ||
      (bucket.file_size_limit && size > bucket.file_size_limit)
    ) {
      return NextResponse.json(
        {
          error:
            "O armazenamento privado não está disponível para este tamanho de arquivo.",
        },
        { status: 503, headers },
      );
    }

    const vehicle =
      typeof body.vehicleId === "string" &&
      /^[a-zA-Z0-9_-]{8,40}$/.test(body.vehicleId)
        ? `${body.vehicleId}/`
        : "";
    const path = `${vehicle}${Date.now()}-${crypto.randomUUID()}.${types[type]}`;
    const storage = getSupabaseAdmin().storage;
    const { data, error } = await storage
      .from(VEHICLE_DOCS_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) throw new Error("sign");

    return NextResponse.json(
      {
        signedUrl: data.signedUrl,
        url: privateFileRef(path),
        name: String(body.name || "Arquivo").slice(0, 250),
      },
      { headers },
    );
  } catch (error) {
    console.error("[admin/files/sign]", error);
    return NextResponse.json(
      { error: "Não foi possível preparar o upload. Tente novamente." },
      { status: 500, headers },
    );
  }
}
