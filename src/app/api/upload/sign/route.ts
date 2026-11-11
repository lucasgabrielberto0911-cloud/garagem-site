import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasTrustedMutationOrigin } from "@/lib/admin-request-origin";
import { isPhotoMasterId } from "@/lib/photo-master";
import { hasAnyR2Config } from "@/lib/r2-photos";
import { stagingObjectPath } from "@/lib/upload-staging";
import {
  VEHICLE_DOCS_BUCKET,
  VEHICLE_PHOTOS_BUCKET,
  ensurePrivateDocsBucket,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
} from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Emite URL assinada para o browser enviar a foto direto ao Storage,
 * evitando o limite de body (~4.5 MB) da Vercel que causa 413.
 */
export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
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
          "Upload indisponível: falta SUPABASE_SERVICE_ROLE_KEY no Vercel.",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      contentType?: string;
      extension?: string;
      id?: string;
    };

    const contentType =
      body.contentType === "image/jpeg" ? "image/jpeg" : "image/webp";
    const extension =
      body.extension === "jpg" || body.extension === "jpeg"
        ? "jpg"
        : contentType === "image/jpeg"
          ? "jpg"
          : "webp";

    const requestedId = typeof body.id === "string" ? body.id : "";
    const stem = isPhotoMasterId(requestedId)
      ? requestedId
      : `${Date.now()}-${crypto.randomUUID()}`;
    const supabase = getSupabaseAdmin();

    // Com R2 ativo, foto pública nova nunca é gravada no Supabase: o upload
    // assinado vai para um objeto privado e /api/upload/publish-staged publica no R2.
    if (hasAnyR2Config()) {
      const stagingPath = stagingObjectPath(stem, extension);
      if (!stagingPath) {
        return NextResponse.json({ error: "Não foi possível preparar o upload." }, { status: 500 });
      }
      await ensurePrivateDocsBucket();
      const { data: staged, error: stagedError } = await supabase.storage
        .from(VEHICLE_DOCS_BUCKET)
        .createSignedUploadUrl(stagingPath);
      if (stagedError || !staged) {
        console.error("Signed staging URL error:", stagedError);
        return NextResponse.json(
          { error: stagedError?.message || "Não foi possível preparar o upload." },
          { status: 500 },
        );
      }
      return NextResponse.json({
        staged: true,
        path: staged.path || stagingPath,
        token: staged.token,
        signedUrl: staged.signedUrl,
        contentType,
      });
    }

    const path = `${stem}.${extension}`;

    const { data, error } = await supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("Signed upload URL error:", error);
      return NextResponse.json(
        { error: error?.message || "Não foi possível preparar o upload." },
        { status: 500 },
      );
    }

    const { data: publicData } = supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: publicData.publicUrl,
      contentType,
    });
  } catch (error) {
    console.error("Upload sign error:", error);
    return NextResponse.json(
      { error: "Erro ao preparar upload." },
      { status: 500 },
    );
  }
}
