import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminNoticeSnapshot } from "@/lib/admin-notice-store";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({}, { status: 401 });
  try {
    const { count, counts } = await getAdminNoticeSnapshot();
    return NextResponse.json({ count, costWarnings: counts.vendas,
      notifications: counts.vendas + counts.hoje + counts.atrasados + counts.pedidos,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[admin/badge] falha ao consultar:", error);
    return NextResponse.json({ count: null, costWarnings: null, notifications: null },
      { headers: { "Cache-Control": "private, no-store" } });
  }
}
