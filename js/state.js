// state.js — the app's in-memory copy of the database, kept in sync on every write.
// Every change is written to IndexedDB FIRST; memory is updated only after the write succeeds.
import * as db from './db.js';
import { uid } from './util.js';
import { newCard, schedule } from './srs.js';

export const APP_VERSION = '1.0.2';

export const state = {
  vocab: new Map(),   // id -> entry
  cards: new Map(),   // vocabId -> card
  logs: [],           // review history
  imports: [],
  settings: { newPerDay: 10, direction: 'es-vi' },
  lastBackup: null,
};

export async function loadState() {
  const [vocab, cards, logs, imports, settings, lastBackup] = await Promise.all([
    db.getAll('vocab'), db.getAll('cards'), db.getAll('logs'), db.getAll('imports'), db.get('meta', 'settings'),
    db.get('meta', 'lastBackup'),
  ]);
  state.lastBackup = lastBackup ? lastBackup.value : null;
  state.vocab = new Map(vocab.map(v => [v.id, v]));
  state.cards = new Map(cards.map(c => [c.vocabId, c]));
  state.logs = logs.sort((a, b) => a.at - b.at);
  state.imports = imports.sort((a, b) => b.at - a.at);
  if (settings) Object.assign(state.settings, settings.value);
}

function flashSaved() { document.dispatchEvent(new CustomEvent('vocab:saved')); }

export const activeVocab = () => [...state.vocab.values()].filter(v => !v.deletedAt);
export const trashedVocab = () => [...state.vocab.values()].filter(v => v.deletedAt);

export function blankEntry() {
  return { id: uid(), es: '', en: '', vi: '', pos: '', article: '', gender: '', plural: '', ipa: '',
    verbInfo: '', adjForms: '', exampleEs: '', exampleEn: '', exampleVi: '', collocations: '',
    topic: '', source: '', page: '', sourceText: '', notes: '', infoOrigin: 'manual',
    favorite: false, createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null };
}

export async function saveVocab(entry) {
  const v = { ...entry, updatedAt: Date.now() };
  await db.put('vocab', v);
  state.vocab.set(v.id, v);
  flashSaved();
  return v;
}

export async function saveVocabBatch(entries, importRecord) {
  const ops = entries.map(v => ({ store: 'vocab', value: v }));
  if (importRecord) ops.push({ store: 'imports', value: importRecord });
  await db.writeMany(ops);
  entries.forEach(v => state.vocab.set(v.id, v));
  if (importRecord) state.imports.unshift(importRecord);
  flashSaved();
}

export async function deleteForever(id) {
  // Removes the word, its schedule and its history.
  const logIds = state.logs.filter(l => l.vocabId === id).map(l => l.id);
  await db.writeMany([
    { store: 'vocab', delete: id }, { store: 'cards', delete: id },
    ...logIds.map(k => ({ store: 'logs', delete: k })),
  ]);
  state.vocab.delete(id); state.cards.delete(id);
  state.logs = state.logs.filter(l => l.vocabId !== id);
  flashSaved();
}

// Flashcard review: updates the schedule AND writes history in one transaction.
export async function recordReview(vocabId, grade, direction) {
  const now = Date.now();
  const card = schedule(state.cards.get(vocabId) || newCard(vocabId), grade, now);
  const log = { id: uid(), vocabId, at: now, mode: 'flashcard', direction, grade, correct: grade !== 'again' };
  await db.writeMany([{ store: 'cards', value: card }, { store: 'logs', value: log }]);
  state.cards.set(vocabId, card);
  state.logs.push(log);
  flashSaved();
  return card;
}

// Quiz practice: saved to history only; does not change the review schedule.
export async function recordPractice(results, mode, direction) {
  const now = Date.now();
  const logs = results.map(r => ({ id: uid(), vocabId: r.vocabId, at: now, mode, direction, correct: !!r.correct }));
  if (!logs.length) return;
  await db.writeMany(logs.map(l => ({ store: 'logs', value: l })));
  state.logs.push(...logs);
  flashSaved();
}

export async function saveSettings() {
  await db.put('meta', { key: 'settings', value: state.settings });
  flashSaved();
}
export async function getMeta(key) { const r = await db.get('meta', key); return r ? r.value : undefined; }
export async function setMeta(key, value) { await db.put('meta', { key, value }); }
export async function delMeta(key) { await db.del('meta', key); }
