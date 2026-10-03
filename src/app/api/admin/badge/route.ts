import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNewLeadsBadgeCount } from "@/lib/admin-stats";
export async function GET() {
  if (!(await getSession())) return NextResponse.json({}, { status: 401 });
  const count = await getNewLeadsBadgeCount();
  return NextResponse.json(
    { count },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
