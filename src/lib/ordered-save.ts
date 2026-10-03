/** Fila de última versão: uma gravação por vez; nunca confirma revisão mais nova. */
export class OrderedSave<T> {
  private latest: { value: T; revision: number } | null = null;
  private running = false;
  private revision = 0;
  constructor(
    private write: (value: T) => Promise<void>,
    private changed: (state: "pending" | "saved" | "error") => void,
  ) {}
  enqueue(value: T) {
    this.latest = { value, revision: ++this.revision };
    this.changed("pending");
    void this.drain();
  }
  retry() {
    if (this.latest) {
      this.changed("pending");
      void this.drain();
    }
  }
  get pending() {
    return this.latest !== null;
  }
  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.latest) {
        const item = this.latest;
        try {
          await this.write(item.value);
        } catch {
          this.changed("error");
          return;
        }
        if (this.latest.revision === item.revision) {
          this.latest = null;
          this.changed("saved");
        }
      }
    } finally {
      this.running = false;
    }
  }
}
