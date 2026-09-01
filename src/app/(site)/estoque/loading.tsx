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
        <div className="mt-8 lg:grid lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="h-28 border border-white/10 bg-ink lg:h-[70vh]" />
          <div>
            <EstoqueBrowseFallback />
          </div>
        </div>
      </Container>
    </div>
  );
}
