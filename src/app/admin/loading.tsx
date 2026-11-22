export default function Loading() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <div className="skeleton col-span-2 h-14 lg:col-span-1" />
        <div className="skeleton h-14" />
        <div className="skeleton h-14" />
        <div className="skeleton h-14" />
        <div className="skeleton h-14" />
      </div>
      <div className="skeleton h-48 w-full" />
      <div className="skeleton h-44 w-full" />
      <div className="skeleton h-40 w-full" />
    </div>
  );
}
