/** Skeleton padrão das telas do painel: cabeçalho, cards e lista. */
export function AdminLoading({
  cards = 4,
  rows = 4,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-1 w-16 bg-brand-gradient" aria-hidden="true" />
        <div className="skeleton mt-3 h-8 w-56" />
        <div className="skeleton mt-3 h-3 w-72 max-w-full" />
      </div>

      {cards > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, index) => (
            <div key={index} className="border border-white/10 px-5 py-4">
              <div className="skeleton h-2.5 w-24" />
              <div className="skeleton mt-3 h-7 w-20" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="skeleton h-16 w-24 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-48 max-w-full" />
                <div className="skeleton h-3 w-32" />
                <div className="skeleton h-3 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
