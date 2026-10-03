import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
export async function GET() {
  const session = await getSession();
  return NextResponse.json(
    { ok: Boolean(session) },
    {
      status: session ? 200 : 401,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
