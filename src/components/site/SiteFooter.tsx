import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/site/ui";
import {
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
  site,
  telUrl,
} from "@/lib/site";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-ink">
      <Container className="py-14 lg:py-16">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/branding/logo.png"
            alt={site.name}
            width={200}
            height={56}
            className="h-12 w-auto"
          />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            {site.tagline}
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
