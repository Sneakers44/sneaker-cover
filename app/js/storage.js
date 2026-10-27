// Piccolo wrapper IndexedDB per lo storico delle cover generate
const DB = 'sneaker-cover';
const STORE = 'covers';
const MAX_ITEMS = 24;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  }));
}

export async function saveCover(item) {
  await tx('readwrite', s => s.put(item));
  const all = await listCovers();
  for (const old of all.slice(MAX_ITEMS)) await deleteCover(old.id);
}

export async function listCovers() {
  const all = await tx('readonly', s => s.getAll());
  return (all || []).sort((a, b) => b.created - a.created);
}

export function deleteCover(id) {
  return tx('readwrite', s => s.delete(id));
}
