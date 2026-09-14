export class KvStore {
  private pages = new Map<string, { value: string; pinned: boolean; lastUsed: number }>();
  get(key: string) {
    const hit = this.pages.get(key);
    if (hit) hit.lastUsed = Date.now();
    return hit?.value;
  }
  put(key: string, value: string, pinned = false) {
    this.pages.set(key, { value, pinned, lastUsed: Date.now() });
  }
  commitObservation() {
    for (const p of this.pages.values()) p.pinned = false;
  }
}
