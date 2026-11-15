import { catalogCsvResponse } from "@/lib/catalog-feed-http";

export const dynamic = "force-dynamic";

export function GET() {
  return catalogCsvResponse();
}
