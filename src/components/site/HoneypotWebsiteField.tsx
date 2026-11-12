/** Campo isca anti-spam: bots preenchem `name="website"`; pessoas e leitores de tela não veem. */
export function HoneypotWebsiteField({ id }: { id: string }) {
  return (
    <div hidden aria-hidden="true">
      <input
        id={id}
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  );
}
