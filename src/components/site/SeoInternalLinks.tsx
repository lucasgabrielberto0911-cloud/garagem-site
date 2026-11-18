import Link from "next/link";

const LINKS = [
  { href: "/seminovos/linhares", label: "Seminovos em Linhares" },
  { href: "/seminovos/aracruz", label: "Seminovos em Aracruz" },
  { href: "/seminovos/grande-vitoria", label: "Seminovos na Grande Vitória" },
  { href: "/seminovos/vitoria", label: "Seminovos em Vitória" },
  { href: "/seminovos/serra", label: "Seminovos na Serra" },
  { href: "/seminovos/vila-velha", label: "Seminovos em Vila Velha" },
  { href: "/seminovos/colatina", label: "Seminovos em Colatina" },
  { href: "/financiamento", label: "Financiamento de seminovos" },
  { href: "/guia/financiamento-seminovos-linhares", label: "Guia de financiamento" },
  { href: "/guia/troca-com-volta", label: "Troca com volta" },
  { href: "/guia/comparativos-estoque", label: "Comparativos do estoque" },
];

/** Links internos para as páginas de cidade e os guias, em ficha e estoque. */
export function SeoInternalLinks() {
  return (
    <nav aria-label="Mais da Garagem" className="mt-10 flex flex-wrap gap-x-5">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex min-h-11 items-center text-sm text-muted underline"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
