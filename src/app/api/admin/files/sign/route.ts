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
const types: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return NextResponse.json({}, { status: 403 });
  if (!(await getSession()))
    return NextResponse.json(
      { error: "Sessão expirada. Entre novamente e tente reenviar." },
      { status: 401 },
    );
  if (!hasSupabaseServiceRole())
    return NextResponse.json(
      { error: "Upload indisponível." },
      { status: 503 },
    );
  try {
    const body = await request.json();
    if (
      typeof types[body.type] !== "string" ||
      !Number.isInteger(body.size) ||
      body.size <= 0 ||
      body.size > 12 * 1024 * 1024
    )
      return NextResponse.json(
        { error: "Use PDF, JPG, PNG ou WEBP de até 12 MB." },
        { status: 400 },
      );
    await ensurePrivateDocsBucket();
    const storage = getSupabaseAdmin().storage;
    const { data: bucket, error: bucketError } =
      await storage.getBucket(VEHICLE_DOCS_BUCKET);
    if (
      bucketError ||
      !bucket ||
      bucket.public ||
      (bucket.file_size_limit && body.size > bucket.file_size_limit)
    )
      return NextResponse.json(
        {
          error:
            "O armazenamento privado não está disponível para este tamanho de arquivo.",
        },
        { status: 503 },
      );
    const vehicle =
      typeof body.vehicleId === "string" &&
      /^[a-zA-Z0-9_-]{8,40}$/.test(body.vehicleId)
        ? `${body.vehicleId}/`
        : "";
    const path = `${vehicle}${Date.now()}-${crypto.randomUUID()}.${types[body.type]}`;
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
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível preparar o upload. Tente novamente." },
      { status: 500 },
    );
  }
}
