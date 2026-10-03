export function focusAdminError(form: HTMLFormElement, name: string) {
  const control = form.elements.namedItem(name);
  if (!(control instanceof HTMLElement)) return;
  const details = control.closest("details");
  if (details) details.open = true;
  requestAnimationFrame(() => {
    control.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    control.focus({ preventScroll: true });
  });
}
