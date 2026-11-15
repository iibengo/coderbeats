/** Un `localStorage` de mentira para probar los composables (Node no tiene). `failWrites` simula almacenamiento lleno o modo privado. */
export class FakeStorage {
  data = new Map<string, string>()
  failWrites = false
  getItem(k: string): string | null {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    if (this.failWrites) throw new DOMException('lleno', 'QuotaExceededError')
    this.data.set(k, v)
  }
  removeItem(k: string): void {
    this.data.delete(k)
  }
}
