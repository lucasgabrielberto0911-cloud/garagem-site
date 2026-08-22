import { EstoqueBrowseFallback } from "@/components/site/EstoqueBrowse";
import { Container, PageHeader } from "@/components/site/ui";

/** Primeiro paint com título real — evita FCP só de blocos cinza. */
export default function EstoqueLoading() {
  return (
    <div className="py-10 lg:py-12">
      <Container>
        <PageHeader
          eyebrow="Estoque"
          title="Veículos disponíveis"
          description="Vistoria e procedência em cada anúncio. Use os filtros para achar o seu."
        />
        <EstoqueBrowseFallback />
      </Container>
    </div>
  );
}
