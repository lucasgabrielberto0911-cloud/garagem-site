import { formatNumberBR } from "@/lib/format";
import { getSiteStats } from "@/lib/vehicles";

/** Usado quando ainda não há dado real no banco — nada de número inventado. */
const EMPTY_LABEL = "Estoque sendo montado";

export async function StatsBar() {
  const { available, sales } = await getSiteStats();

  return (
    <dl className="grid grid-cols-2 divide-x divide-white/10 border border-white/10 bg-ink/70 backdrop-blur">
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
    <div className="px-3 py-3.5 text-center sm:px-6 sm:py-5">
      {hasValue ? (
        <dd className="font-display text-2xl font-bold text-cream sm:text-4xl">
          {formatNumberBR(value)}
          <span className="ml-1.5 align-middle font-body text-[10px] font-medium uppercase tracking-wider text-muted sm:ml-2 sm:text-xs">
            {suffix}
          </span>
        </dd>
      ) : (
        <dd className="font-display text-sm font-semibold text-brand-yellow sm:text-lg">
          {EMPTY_LABEL}
        </dd>
      )}
      <dt className="mt-1 text-[10px] uppercase tracking-wider text-muted sm:mt-1.5 sm:text-xs">
        {label}
      </dt>
    </div>
  );
}

export function StatsBarSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-2 divide-x divide-white/10 border border-white/10 bg-ink/70">
      {[0, 1].map((index) => (
        <div key={index} className="px-3 py-5 sm:px-6 sm:py-7">
          <div className="mx-auto h-7 w-20 bg-white/10 sm:h-8 sm:w-28" />
          <div className="mx-auto mt-2 h-3 w-28 bg-white/5 sm:w-40" />
        </div>
      ))}
    </div>
  );
}
