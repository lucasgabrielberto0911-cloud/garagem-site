import { isSameOriginRequest } from "@/lib/admin-request-origin";
import { getSession } from "@/lib/auth";
import { judgeListingQuality, parseListingDraft } from "@/lib/listing-quality";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

/**
 * Nota do anúncio para o admin. Autenticada.
 * A chave do Jev não sai do servidor. Sem chave ou com a API fora,
 * devolve judgment null e o formulário segue.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401, headers },
    );
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Acesso inválido." },
      { status: 403, headers },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400, headers },
    );
  }

  const draft = parseListingDraft(body);
  if (!draft) {
    return NextResponse.json(
      { error: "Dados inválidos." },
      { status: 400, headers },
    );
  }

  const judgment = await judgeListingQuality(draft);
  return NextResponse.json({ judgment }, { headers });
}
