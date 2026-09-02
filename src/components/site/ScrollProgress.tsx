export function ScrollProgress() {
  return (
    <div
      className="scroll-progress pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      aria-hidden="true"
    >
      <div className="scroll-progress-bar h-full origin-left progress-brand" />
    </div>
  );
}
