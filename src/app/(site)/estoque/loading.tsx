import { EstoqueBrowseFallback } from "@/components/site/EstoqueBrowse";
import { StockFiltersSkeleton } from "@/components/site/StockFiltersSkeleton";
import { Container, PageHeader } from "@/components/site/ui";

/** Primeiro paint com título real — evita FCP só de blocos cinza. */
export default function EstoqueLoading() {
  return (
    <div data-stock-page="" className="stock-page py-4 lg:py-12">
      <Container>
        <PageHeader
          eyebrow="Estoque"
          title="Veículos disponíveis"
          description="Cada veículo é revisado e sai com garantia. Use os filtros para achar o seu."
          headingAs="p"
        />
        <div className="stock-shell mt-3 lg:mt-8 lg:grid lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <StockFiltersSkeleton />
          <div>
            <EstoqueBrowseFallback />
          </div>
        </div>
      </Container>
    </div>
  );
}
