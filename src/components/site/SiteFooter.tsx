import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/site/ui";
import {
  IconClock,
  IconInstagram,
  IconMail,
  IconMapPin,
  IconPhone,
} from "@/components/site/icons";
import {
  NAV_LINKS,
  PHONES,
  SECONDARY_LINKS,
  SERVICES,
  telUrl,
  type SiteConfig,
} from "@/lib/site";
import { getPublicSite } from "@/lib/site-settings";

export async function SiteFooter() {
  const site: SiteConfig = await getPublicSite();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-ink">
      <Container className="py-14 lg:py-16">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/branding/logo-wordmark.png"
            alt={site.name}
            width={320}
            height={58}
            className="h-12 w-auto sm:h-14"
          />
          <div className="mx-auto mt-5 h-0.5 w-14 bg-brand-gradient" aria-hidden="true" />
          <p className="mt-5 max-w-lg font-display text-base font-semibold leading-snug text-cream sm:text-lg">
            Seminovos com procedência em {site.region} e região
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
            Loja digital com atendimento online das 8h às 23h — compra, venda,
            troca e financiamento no {site.state}, com foco em qualidade e no
            melhor atendimento.
          </p>
          <a
            href={site.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-sm text-muted transition hover:text-cream"
          >
            <IconInstagram className="h-4 w-4" />
            {site.instagram}
          </a>
        </div>

        <div className="mt-12 grid gap-10 text-center sm:grid-cols-3">
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
              Navegação
            </h2>
            <ul className="mt-4 space-y-2.5">
              {[...NAV_LINKS, ...SECONDARY_LINKS].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted transition hover:text-cream"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
              Serviços
            </h2>
            <ul className="mt-4 space-y-2.5">
              {SERVICES.map((service) => (
                <li key={service} className="text-sm text-muted">
                  {service}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
              Contato
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              {PHONES.map((phone, index) => (
                <li key={phone.digits}>
                  <a
                    href={telUrl(index)}
                    className="inline-flex items-center justify-center gap-2 transition hover:text-cream"
                  >
                    <IconPhone className="h-4 w-4 shrink-0 text-brand" />
                    <span>{phone.label}</span>
                  </a>
                </li>
              ))}
              <li className="flex items-center justify-center gap-2">
                <IconMail className="h-4 w-4 shrink-0 text-brand" />
                <span>{site.email}</span>
              </li>
              <li className="flex items-start justify-center gap-2">
                <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{site.address}</span>
              </li>
              <li className="flex items-center justify-center gap-2 text-xs">
                <IconClock className="h-4 w-4 shrink-0 text-brand" />
                <span>{site.hours}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 h-0.5 w-full bg-brand-gradient" aria-hidden="true" />

        <div className="mt-6 flex flex-col items-center gap-2 text-center text-xs text-muted">
          <p>
            © {year} {site.name}. Todos os direitos reservados.
          </p>
          <p>
            {site.legalName} — CNPJ {site.cnpj}
          </p>
          <Link href="/admin/login" className="transition hover:text-cream">
            Área administrativa
          </Link>
        </div>
      </Container>
    </footer>
  );
}
