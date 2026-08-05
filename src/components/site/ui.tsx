import Link from "next/link";
import type { ReactNode } from "react";
import { IconWhatsApp } from "@/components/site/icons";
import { whatsappUrl } from "@/lib/site";

/**
 * Larguras de leitura padronizadas do site. Todo conteúdo passa por aqui para
 * ficar centralizado e com a mesma margem lateral em qualquer página.
 */
const WIDTHS = {
  text: "max-w-3xl",
  narrow: "max-w-4xl",
  content: "max-w-6xl",
} as const;

export type ContainerSize = keyof typeof WIDTHS;

export function Container({
  children,
  size = "content",
  className = "",
}: {
  children: ReactNode;
  size?: ContainerSize;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full px-4 sm:px-6 ${WIDTHS[size]} ${className}`}>
      {children}
    </div>
  );
}

const SPACING = {
  default: "py-14 lg:py-20",
  tight: "py-8 lg:py-10",
  none: "",
} as const;

export function Section({
  children,
  className = "",
  size = "content",
  spacing = "default",
  id,
}: {
  children: ReactNode;
  className?: string;
  size?: ContainerSize;
  spacing?: keyof typeof SPACING;
  id?: string;
}) {
  return (
    <section id={id} className={`${SPACING[spacing]} ${className}`}>
      <Container size={size}>{children}</Container>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="text-center">
      {eyebrow ? (
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl lg:text-4xl">
        {title}
      </h2>
      <div className="mx-auto mt-4 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
      {description ? (
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/** Cabeçalho padrão das páginas internas — sempre centralizado. */
export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="text-center">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
        {title}
      </h1>
      <div className="mx-auto mt-4 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
      {description ? (
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function WhatsAppButton({
  message,
  children = "Chamar no WhatsApp",
  size = "md",
  variant = "solid",
  className = "",
}: {
  message?: string;
  children?: ReactNode;
  size?: "md" | "lg";
  variant?: "solid" | "outline";
  className?: string;
}) {
  const sizing =
    size === "lg"
      ? "min-h-[52px] px-7 py-4 text-sm sm:text-base"
      : "min-h-[48px] px-5 py-3 text-xs sm:text-sm";
  const look =
    variant === "solid"
      ? "bg-brand text-cream hover:bg-[#c91418]"
      : "border border-white/20 text-cream hover:border-brand hover:bg-white/5";

  return (
    <a
      href={whatsappUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2.5 font-display font-semibold uppercase tracking-wide transition touch-manipulation ${sizing} ${look} ${className}`}
    >
      <IconWhatsApp className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      {children}
    </a>
  );
}

export function ButtonLink({
  href,
  children,
  size = "md",
  variant = "solid",
  className = "",
}: {
  href: string;
  children: ReactNode;
  size?: "md" | "lg";
  variant?: "solid" | "outline";
  className?: string;
}) {
  const sizing =
    size === "lg"
      ? "min-h-[52px] px-7 py-4 text-sm sm:text-base"
      : "min-h-[48px] px-5 py-3 text-xs sm:text-sm";
  const look =
    variant === "solid"
      ? "bg-cream text-asphalt hover:bg-white"
      : "border border-white/20 text-cream hover:border-brand hover:bg-white/5";

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2.5 font-display font-semibold uppercase tracking-wide transition touch-manipulation ${sizing} ${look} ${className}`}
    >
      {children}
    </Link>
  );
}

/** Linha de botões centralizada, com quebra previsível no mobile. */
export function ActionRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center ${className}`}
    >
      {children}
    </div>
  );
}
