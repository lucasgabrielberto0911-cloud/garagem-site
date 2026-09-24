import { catalogCsvResponse } from "@/lib/catalog-feed-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Alias do feed agendado. O Commerce Manager pode usar esta URL ou /catalog/meta.csv. */
export function GET(request: Request) {
  return catalogCsvResponse(request);
}
