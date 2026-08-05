export function Loader({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"
        role="status"
        aria-label={label}
      />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
