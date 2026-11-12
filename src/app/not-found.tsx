import type { Metadata } from "next";
import SiteLayout from "@/app/(site)/layout";
import { NotFoundContent } from "@/components/site/NotFoundContent";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Página não encontrada | ${site.name}`,
  description:
    "O endereço não existe, foi alterado ou o anúncio não está mais disponível. Volte ao estoque ou fale com a Garagem pelo WhatsApp.",
};

export default function RootNotFound() {
  return (
    <SiteLayout>
      <NotFoundContent />
    </SiteLayout>
  );
}
