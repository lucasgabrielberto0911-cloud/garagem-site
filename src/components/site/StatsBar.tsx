import { formatNumberBR } from "@/lib/format";
import { getSiteStats } from "@/lib/vehicles";

/** Usado quando ainda não há dado real no banco — nada de número inventado. */
const EMPTY_LABEL = "Estoque sendo montado";

export async function StatsBar() {
  const { available, sales } = await getSiteStats();

  return (
    <dl className="grid grid-cols-1 divide-y divide-white/10 border border-white/10 bg-ink/70 backdrop-blur sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      <Stat
        value={available}
        label="Veículos disponíveis agora"
        suffix={available === 1 ? "veículo" : "veículos"}
      />
      <Stat
        value={sales}
        label="Negócios fechados"
        suffix={sales === 1 ? "venda" : "vendas"}
      />
    </dl>
  );
}

function Stat({
  value,
  label,
  suffix,
}: {
  value: number;
  label: string;
  suffix: string;
}) {
  const hasValue = value > 0;

  return (
    <div className="px-5 py-5 text-center sm:px-6">
      {hasValue ? (
        <dd className="font-display text-3xl font-bold text-cream sm:text-4xl">
          {formatNumberBR(value)}
          <span className="ml-2 align-middle font-body text-xs font-medium uppercase tracking-wider text-muted">
            {suffix}
          </span>
        </dd>
      ) : (
        <dd className="font-display text-base font-semibold text-brand-yellow sm:text-lg">
          {EMPTY_LABEL}
        </dd>
      )}
      <dt className="mt-1.5 text-xs uppercase tracking-wider text-muted">{label}</dt>
    </div>
  );
}

export function StatsBarSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-1 divide-y divide-white/10 border border-white/10 bg-ink/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      {[0, 1].map((index) => (
        <div key={index} className="px-6 py-7">
          <div className="mx-auto h-8 w-28 bg-white/10" />
          <div className="mx-auto mt-2 h-3 w-40 bg-white/5" />
        </div>
      ))}
    </div>
  );
}
