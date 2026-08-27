import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabaseAdmin, parseStoredFileRef } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_TTL_SEC = 60;

/**
 * Abre comprovante/documento só com sessão de admin.
 * Refs privadas viram URL assinada curta; URLs públicas antigas redirecionam.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const ref = request.nextUrl.searchParams.get("ref") ?? "";
  const parsed = parseStoredFileRef(ref);
  if (!parsed) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  if (parsed.kind === "public") {
    return NextResponse.redirect(parsed.url, 302);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, SIGNED_TTL_SEC);

    if (error || !data?.signedUrl) {
      console.error("[admin/files/view]", error);
      return NextResponse.json(
        { error: "Não foi possível abrir o arquivo." },
        { status: 500 },
      );
    }

    return NextResponse.redirect(data.signedUrl, 302);
  } catch (error) {
    console.error("[admin/files/view]", error);
    return NextResponse.json(
      { error: "Não foi possível abrir o arquivo." },
      { status: 500 },
    );
  }
}
