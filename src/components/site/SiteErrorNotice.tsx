export function SiteErrorNotice({
  message = "Não foi possível carregar os dados agora. Tente novamente em instantes.",
}: {
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="mb-5 border border-brand-orange/40 bg-brand-orange/10 px-4 py-3 text-center text-sm text-cream"
    >
      <p className="font-display text-sm font-semibold text-brand-orange">
        Instabilidade temporária
      </p>
      <p className="mt-1 text-xs leading-relaxed text-cream/80">{message}</p>
    </div>
  );
}
