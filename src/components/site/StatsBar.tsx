import { formatNumberBR } from "@/lib/format";
import { getSiteStats } from "@/lib/vehicles";

export async function StatsBar() {
  const { available, sales } = await getSiteStats();

  return (
    <dl className="grid grid-cols-2 divide-x divide-white/15 border border-white/20 bg-ink">
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
  return (
    <div className="px-3 py-2.5 text-center sm:px-4 sm:py-3">
      <dd
        className="font-display text-xl font-semibold text-cream sm:text-2xl"
        aria-label={`${formatNumberBR(value)} ${suffix}`}
      >
        <span aria-hidden="true">
          {formatNumberBR(value)}{" "}
          <span className="align-middle font-body text-[13px] font-medium tracking-wide text-cream/75 sm:text-sm">
            {suffix}
          </span>
        </span>
      </dd>
      <dt className="mt-1 text-xs uppercase tracking-wider text-cream/75 sm:mt-1.5 sm:text-[13px]">
        {label}
      </dt>
    </div>
  );
}

export function StatsBarSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-2 divide-x divide-white/10 border border-white/10 bg-ink/70">
      {[0, 1].map((index) => (
        <div key={index} className="px-3 py-2.5 text-center sm:px-4 sm:py-3">
          <div className="mx-auto h-7 w-20 bg-white/10 sm:h-8 sm:w-28" />
          <div className="mx-auto mt-1 h-4 w-28 bg-white/5 sm:mt-1.5 sm:w-40" />
        </div>
      ))}
    </div>
  );
}
