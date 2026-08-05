import Link from "next/link";
import type { ReactNode } from "react";
import { IconWhatsApp } from "@/components/site/icons";
import { whatsappUrl } from "@/lib/site";

export function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`px-4 py-14 sm:px-6 lg:py-20 ${className}`}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <div className={centered ? "text-center" : ""}>
      {eyebrow ? (
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl lg:text-4xl">
        {title}
      </h2>
      <div
        className={`mt-4 h-0.5 w-16 bg-brand-gradient ${centered ? "mx-auto" : ""}`}
        aria-hidden="true"
      />
      {description ? (
        <p
          className={`mt-5 text-sm leading-relaxed text-muted sm:text-base ${
            centered ? "mx-auto max-w-2xl" : "max-w-2xl"
          }`}
        >
          {description}
        </p>
      ) : null}
    </div>
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
      ? "px-7 py-4 text-sm sm:text-base"
      : "px-5 py-3 text-xs sm:text-sm";
  const look =
    variant === "solid"
      ? "bg-brand text-cream hover:bg-[#c91418]"
      : "border border-white/20 text-cream hover:border-brand hover:bg-white/5";

  return (
    <a
      href={whatsappUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2.5 font-display font-semibold uppercase tracking-wide transition ${sizing} ${look} ${className}`}
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
      ? "px-7 py-4 text-sm sm:text-base"
      : "px-5 py-3 text-xs sm:text-sm";
  const look =
    variant === "solid"
      ? "bg-cream text-asphalt hover:bg-white"
      : "border border-white/20 text-cream hover:border-brand hover:bg-white/5";

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2.5 font-display font-semibold uppercase tracking-wide transition ${sizing} ${look} ${className}`}
    >
      {children}
    </Link>
  );
}
