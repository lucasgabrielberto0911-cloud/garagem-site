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
  whatsappUrl,
  type SiteConfig,
} from "@/lib/site";
import { getPublicSite } from "@/lib/site-settings";

export async function SiteFooter() {
  const site: SiteConfig = await getPublicSite();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-ink">
      <Container className="py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr_1fr] lg:items-start lg:gap-8 lg:text-left">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <Image
              src="/branding/logo-wordmark.png"
              alt={site.name}
              width={320}
              height={58}
              className="h-11 w-auto sm:h-12"
            />
            <div
              className="mt-4 h-0.5 w-14 bg-brand-gradient"
              aria-hidden="true"
            />
            <p className="mt-4 max-w-sm font-display text-base font-semibold leading-snug text-cream">
              Seminovos com procedência em {site.region} e região
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
              Loja digital · atendimento online das 8h às 23h.
            </p>
            <a
              href={site.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 text-sm text-muted transition hover:text-cream"
            >
              <IconInstagram className="h-4 w-4" />
              {site.instagram}
            </a>
          </div>

          <div className="hidden sm:block">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
              Navegação
            </h2>
            <ul className="mt-4 space-y-1">
              {[...NAV_LINKS, ...SECONDARY_LINKS].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-[36px] items-center text-sm text-muted transition hover:text-cream"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden sm:block">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
              Serviços
            </h2>
            <ul className="mt-4 space-y-1">
              {SERVICES.map((service) => (
                <li key={service.label}>
                  <Link
                    href={service.href}
                    className="inline-flex min-h-[36px] items-center text-sm text-muted transition hover:text-cream"
                  >
                    {service.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden sm:block">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
              Contato
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              {PHONES.map((phone, index) => (
                <li key={phone.digits}>
                  <a
                    href={telUrl(index)}
                    className="inline-flex min-h-[36px] items-center gap-2 transition hover:text-cream"
                  >
                    <IconPhone className="h-4 w-4 shrink-0 text-brand" />
                    <span>{phone.label}</span>
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={whatsappUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[36px] items-center gap-2 transition hover:text-cream"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="inline-flex min-h-[36px] items-center gap-2 transition hover:text-cream"
                >
                  <IconMail className="h-4 w-4 shrink-0 text-brand" />
                  <span>{site.email}</span>
                </a>
              </li>
              <li className="flex items-start gap-2">
                <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{site.address}</span>
              </li>
              <li className="flex items-center gap-2 text-xs">
                <IconClock className="h-4 w-4 shrink-0 text-brand" />
                <span>{site.hours}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Mobile: contato essencial */}
        <div className="mt-8 space-y-3 text-center sm:hidden">
          {PHONES.map((phone, index) => (
            <a
              key={phone.digits}
              href={telUrl(index)}
              className="flex min-h-[48px] items-center justify-center gap-2 border border-white/10 bg-asphalt/50 text-sm text-cream touch-manipulation"
            >
              <IconPhone className="h-4 w-4 text-brand" />
              {phone.label}
            </a>
          ))}
          <a
            href={`mailto:${site.email}`}
            className="flex min-h-[48px] items-center justify-center gap-2 border border-white/10 bg-asphalt/50 text-sm text-cream touch-manipulation"
          >
            <IconMail className="h-4 w-4 text-brand" />
            {site.email}
          </a>
          <p className="pt-1 text-xs text-muted">{site.hours}</p>
        </div>

        <div className="mt-10 h-px w-full bg-white/10" aria-hidden="true" />

        <div className="mt-5 flex flex-col items-center gap-2 text-center text-xs text-muted lg:flex-row lg:justify-between lg:text-left">
          <div>
            <p>
              © {year} {site.name}. Todos os direitos reservados.
            </p>
            <p className="mt-1">
              {site.legalName} — CNPJ {site.cnpj}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link href="/privacidade" className="transition hover:text-cream">
              Privacidade
            </Link>
            <Link href="/faq" className="transition hover:text-cream">
              Dúvidas
            </Link>
            <Link href="/admin/login" className="transition hover:text-cream">
              Área administrativa
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
