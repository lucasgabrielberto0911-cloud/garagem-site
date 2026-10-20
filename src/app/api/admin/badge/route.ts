import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminNoticeSnapshot } from "@/lib/admin-notice-store";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({}, { status: 401 });
  try {
    const { count, unanswered30m, unanswered2h, counts } =
      await getAdminNoticeSnapshot();
    return NextResponse.json(
      {
        count,
        unanswered30m,
        unanswered2h,
        costWarnings: counts.vendas,
        agenda: counts.hoje + counts.atrasados,
        notifications:
          counts.vendas + counts.hoje + counts.atrasados + counts.pedidos,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[admin/badge] falha ao consultar:", error);
    return NextResponse.json(
      {
        count: null,
        unanswered30m: null,
        unanswered2h: null,
        costWarnings: null,
        notifications: null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
