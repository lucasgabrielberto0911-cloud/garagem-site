import {
  IconClock,
  IconClipboardCheck,
  IconFileText,
  IconPlay,
  IconShieldCheck,
} from "@/components/site/icons";

const NOTES = [
  {
    Icon: IconShieldCheck,
    label: "Garantia de 3 meses — motor e câmbio",
  },
  {
    Icon: IconClipboardCheck,
    label: "Vistoria completa antes de anunciar",
  },
  {
    Icon: IconFileText,
    label: "Documentação pronta",
  },
  {
    Icon: IconClock,
    label: "Atendimento online 8h–23h",
  },
] as const;

const VIDEO_NOTE = { Icon: IconPlay, label: "Vídeo do carro pelo WhatsApp, se quiser" } as const;

/**
 * Confiança ao lado do preço. Os itens fixos são da loja; `warranty` e
 * `documentation` só entram se o admin preencheu para este veículo.
 */
export function VehicleTrustNotes({
  className = "",
  warranty,
  documentation,
}: {
  className?: string;
  warranty?: string | null;
  documentation?: string | null;
}) {
  const own = [
    warranty?.trim() ? { Icon: IconShieldCheck, label: `Garantia deste carro: ${warranty.trim()}` } : null,
    documentation?.trim() ? { Icon: IconFileText, label: documentation.trim() } : null,
  ].filter((note) => note !== null);
  const notes = [...own, ...NOTES, VIDEO_NOTE];
  return (
    <section
      aria-label="Por que comprar na Garagem"
      className={`border border-white/10 bg-asphalt/50 px-3 py-3 ${className}`}
    >
      <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-cream">
        Por que comprar na Garagem
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
      {notes.map(({ Icon, label }) => (
        <li
          key={label}
          className="flex items-center gap-2 text-left text-[11px] leading-snug text-cream/85"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-brand-light" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        </li>
      ))}
      </ul>
    </section>
  );
}
