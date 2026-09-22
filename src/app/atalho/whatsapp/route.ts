import { NextResponse } from "next/server";
import { pwaShortcutWhatsAppUrl } from "@/lib/site";

/**
 * Atalho do PWA. O manifesto só aceita URL dentro do escopo do site;
 * daqui o navegador abre o wa.me com o mesmo UTM dos outros CTAs.
 */
export function GET() {
  return NextResponse.redirect(pwaShortcutWhatsAppUrl(), 302);
}
