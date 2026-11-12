import ws from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = ws;
}

class MemoryStorage {
  private store: Record<string, string> = {};
  getItem(key: string) { return this.store[key] ?? null; }
  setItem(key: string, value: string) { this.store[key] = String(value); }
  removeItem(key: string) { delete this.store[key]; }
  clear() { this.store = {}; }
  get length() { return Object.keys(this.store).length; }
  key(index: number) { return Object.keys(this.store)[index] ?? null; }
}

if (typeof (globalThis as any).sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = new MemoryStorage();
}
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = new MemoryStorage();
}
