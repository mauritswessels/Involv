export interface SavedSnapshot { ids: Set<string>; pending: Set<string>; ready: boolean }

/** One writer per card, plus versioned hydration. A store belongs to one user. */
export class SavedState {
  private ids = new Set<string>();
  private pending = new Set<string>();
  private ready = false;
  private active = true;
  revision = 0;
  constructor(
    private write: (id: string, wasSaved: boolean) => Promise<void>,
    private changed: (value: SavedSnapshot) => void,
    private failed: (error: unknown) => void,
  ) {}
  activate() { this.active = true; }
  dispose() { this.active = false; this.revision++; }
  private emit() {
    if (this.active) this.changed({ ids: new Set(this.ids), pending: new Set(this.pending), ready: this.ready });
  }
  hydrate(ids: string[], expectedRevision: number) {
    if (!this.active || this.pending.size || this.revision !== expectedRevision) return;
    this.ids = new Set(ids); this.ready = true; this.emit();
  }
  async toggle(id: string): Promise<void> {
    if (!this.active || !this.ready || this.pending.has(id)) return;
    const wasSaved = this.ids.has(id);
    this.pending.add(id); this.revision++;
    wasSaved ? this.ids.delete(id) : this.ids.add(id);
    this.emit();
    try { await this.write(id, wasSaved); }
    catch (error) {
      if (this.active) {
        wasSaved ? this.ids.add(id) : this.ids.delete(id);
        this.failed(error);
      }
    } finally { this.pending.delete(id); this.revision++; this.emit(); }
  }
}
