// db.js — IndexedDB storage layer. All data stays on this device.
// Stores:
//   vocab   — vocabulary entries (keyPath: id, a stable UUID)
//   cards   — spaced-repetition state, one per vocabulary entry (keyPath: vocabId)
//   logs    — review / practice history (keyPath: id)
//   imports — records of imported texts/documents (keyPath: id)
//   meta    — settings, drafts, last backup date (keyPath: key)
// Rule for future versions: upgrades may ADD stores/indexes, never delete user data.

const DB_NAME = 'spanishVocabDB';
const DB_VERSION = 1;
export const DATA_STORES = ['vocab', 'cards', 'logs', 'imports'];

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) {
      reject(new Error('This browser does not support IndexedDB storage.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('vocab')) {
        const s = db.createObjectStore('vocab', { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'vocabId' });
      if (!db.objectStoreNames.contains('logs')) {
        const l = db.createObjectStore('logs', { keyPath: 'id' });
        l.createIndex('vocabId', 'vocabId');
        l.createIndex('at', 'at');
      }
      if (!db.objectStoreNames.contains('imports')) db.createObjectStore('imports', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        alert('The app was updated in another window. Please reload this page.');
      };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error || new Error('Could not open the database.')); };
    req.onblocked = () => console.warn('Database upgrade blocked by another open window.');
  });
  return dbPromise;
}

function reqP(r) {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
function done(tx) {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error || new Error('Database write failed.'));
    tx.onabort = () => rej(tx.error || new Error('Database write was cancelled (storage may be full).'));
  });
}

export async function getAll(store) {
  const db = await openDB();
  return reqP(db.transaction(store).objectStore(store).getAll());
}
export async function get(store, key) {
  const db = await openDB();
  return reqP(db.transaction(store).objectStore(store).get(key));
}
export async function put(store, value) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  await done(tx);
  return value;
}
export async function del(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await done(tx);
}

// Write several records across stores in ONE transaction (all succeed or none do).
// ops: [{ store, value }] or [{ store, delete: key }]
export async function writeMany(ops) {
  const db = await openDB();
  const stores = [...new Set(ops.map(o => o.store))];
  const tx = db.transaction(stores, 'readwrite');
  for (const o of ops) {
    if ('delete' in o) tx.objectStore(o.store).delete(o.delete);
    else tx.objectStore(o.store).put(o.value);
  }
  await done(tx);
}

export async function exportAll(appVersion) {
  const [vocab, cards, logs, imports, settings] = await Promise.all([
    getAll('vocab'), getAll('cards'), getAll('logs'), getAll('imports'), get('meta', 'settings'),
  ]);
  return {
    app: 'spanish-vocab',
    schema: 1,
    appVersion,
    exportedAt: new Date().toISOString(),
    counts: { vocab: vocab.length, cards: cards.length, logs: logs.length, imports: imports.length },
    vocab, cards, logs, imports,
    settings: settings ? settings.value : null,
  };
}

// mode 'merge': add records whose id is not already here; existing records are kept untouched.
// mode 'replace': clear all learning data, then load the backup. One transaction: if anything
// fails, nothing changes.
export async function importBackup(data, mode) {
  const db = await openDB();
  const tx = db.transaction([...DATA_STORES, 'meta'], 'readwrite');
  const result = { added: {}, skipped: {} };
  const keyOf = { vocab: 'id', cards: 'vocabId', logs: 'id', imports: 'id' };
  for (const s of DATA_STORES) {
    result.added[s] = 0; result.skipped[s] = 0;
    const os = tx.objectStore(s);
    const items = Array.isArray(data[s]) ? data[s] : [];
    if (mode === 'replace') {
      os.clear();
      for (const it of items) { os.put(it); result.added[s]++; }
    } else {
      for (const it of items) {
        const r = os.getKey(it[keyOf[s]]);
        r.onsuccess = () => {
          if (r.result === undefined) { os.put(it); result.added[s]++; } else result.skipped[s]++;
        };
      }
    }
  }
  if (mode === 'replace' && data.settings) tx.objectStore('meta').put({ key: 'settings', value: data.settings });
  await done(tx);
  return result;
}

export async function wipeAll() {
  const db = await openDB();
  const tx = db.transaction([...DATA_STORES, 'meta'], 'readwrite');
  for (const s of [...DATA_STORES, 'meta']) tx.objectStore(s).clear();
  await done(tx);
}
