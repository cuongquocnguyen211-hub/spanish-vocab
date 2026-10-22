// more.js — backup & restore, CSV export, storage status, settings, starter words, install help.
import * as db from './db.js';
import { state, loadState, activeVocab, saveSettings, saveVocabBatch, setMeta, blankEntry, APP_VERSION } from './state.js';
import { $, esc, toast, modal, confirmBox, saveFile, dayKey, fmtDate, keyOf } from './util.js';
import { posInfo, displayEs } from './labels.js';
import { DAY } from './srs.js';

export function backupReminderDue(nWords) {
  if (nWords < 5) return false;
  return !state.lastBackup || Date.now() - state.lastBackup > 7 * DAY;
}

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export async function renderMore(el, { reload }) {
  const words = activeVocab();
  let persisted = null, estimate = null;
  try { if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted(); } catch {}
  try { if (navigator.storage && navigator.storage.estimate) estimate = await navigator.storage.estimate(); } catch {}
  const mb = n => (n / 1048576).toFixed(n < 1048576 ? 2 : 1) + ' MB';
  const starterAdded = words.some(v => v.source === STARTER_SOURCE);

  el.innerHTML = `
  ${isStandalone() ? '' : `<section class="card notice-card">
    <h2>📱 Add to iPhone Home Screen</h2>
    <ol class="small"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (square with arrow ↑).</li>
    <li>Choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</li><li>Always open the app from the new Home Screen icon.</li></ol>
    <p class="small vi">Mở bằng Safari → nút Chia sẻ → “Thêm vào MH chính”. Luôn mở ứng dụng từ biểu tượng mới.</p>
    <p class="small"><b>Important:</b> the Home Screen app keeps its own storage, separate from Safari tabs. Words you add in a Safari tab will not appear in the Home Screen app. Use Backup → Restore to move them.</p>
  </section>`}

  <section class="card">
    <h2>💾 Backup & restore · Sao lưu</h2>
    <p class="small">Last backup: <b>${state.lastBackup ? fmtDate(state.lastBackup) : 'never · chưa có'}</b></p>
    <button class="btn primary block" id="backup">Download full backup (JSON) · Sao lưu</button>
    <p class="small muted">Includes all words, review schedule and history. On iPhone choose “Save to Files”. Back up every week.</p>
    <label class="btn block">Restore from backup · Khôi phục<input type="file" accept="application/json,.json" id="restoreIn" hidden></label>
    <button class="btn block" id="csv">Export vocabulary (CSV for Excel / Sheets)</button>
  </section>

  <section class="card">
    <h2>📦 Storage on this device · Bộ nhớ</h2>
    <p class="small">${words.length} words · ${state.logs.length} review records${estimate ? ` · using ${mb(estimate.usage || 0)}` : ''}</p>
    <p class="small">Persistent storage: <b>${persisted === null ? 'unknown' : persisted ? 'granted ✓' : 'not granted'}</b>
    ${persisted === false ? '<button class="btn small" id="persist">Request</button>' : ''}</p>
    <p class="small muted">Your data is stored only in this browser on this device — no account, no server, no cloud.
    It can be lost if you clear Safari website data, delete the Home Screen app, or change phones. A backup file is your safety copy.<br>
    <span class="vi">Dữ liệu chỉ nằm trên thiết bị này. Nếu xóa dữ liệu Safari, xóa ứng dụng hoặc đổi điện thoại thì có thể mất — hãy sao lưu thường xuyên.</span></p>
  </section>

  <section class="card">
    <h2>⚙️ Settings · Cài đặt</h2>
    <label class="fl"><span>New words per day · Số từ mới mỗi ngày</span>
      <input type="number" id="newPerDay" min="0" max="100" inputmode="numeric" value="${state.settings.newPerDay}"></label>
  </section>

  <section class="card">
    <h2>📄 Imported documents · Tài liệu đã nhập</h2>
    ${state.imports.length ? `<ul class="plain small">${state.imports.map(r => {
      const n = words.filter(v => v.importId === r.id).length;
      return `<li><b>${esc(r.name)}</b>${r.page ? ` · p. ${esc(r.page)}` : ''} — ${fmtDate(r.at)} · ${n} words${r.topic ? ' · ' + esc(r.topic) : ''}</li>`;
    }).join('')}</ul>` : '<p class="small muted">No imports yet. · Chưa nhập tài liệu nào.</p>'}
    <a class="btn block" href="#import">Import a list · Nhập danh sách</a>
  </section>

  <section class="card">
    <h2>🌱 Starter words · Từ mẫu</h2>
    <p class="small">Adds ${STARTER.length} common beginner words so you can try the app. They were written by Claude (AI) and are labelled “AI suggestion — please verify”. Edit or delete them any time.</p>
    <button class="btn block" id="starter" ${starterAdded ? 'disabled' : ''}>${starterAdded ? 'Starter words added ✓' : `Add ${STARTER.length} starter words`}</button>
  </section>

  <section class="card danger-zone">
    <h2>Delete all data · Xóa toàn bộ</h2>
    <p class="small">Permanently removes every word and all history from this device.</p>
    <button class="btn danger block" id="wipe">Delete everything…</button>
  </section>

  <p class="small muted center">Spanish Vocabulary v${APP_VERSION} · works offline · no tracking, no ads<br>Mode: ${isStandalone() ? 'Home Screen app' : 'browser tab'}</p>`;

  $('#backup').onclick = () => downloadBackup().then(() => reload());
  $('#csv').onclick = exportCSV;
  $('#restoreIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) { await restoreFrom(f); reload(); } };
  const p = $('#persist');
  if (p) p.onclick = async () => {
    const ok = await navigator.storage.persist().catch(() => false);
    toast(ok ? 'Persistent storage granted ✓' : 'The browser did not grant it. Adding the app to the Home Screen and using it regularly helps. Keep making backups.', { type: ok ? 'success' : 'info', duration: 7000 });
    reload();
  };
  $('#newPerDay').onchange = async e => {
    const n = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
    state.settings.newPerDay = n; e.target.value = n;
    try { await saveSettings(); } catch (err) { toast('Could not save: ' + err.message, { type: 'error' }); }
  };
  $('#starter').onclick = async () => { await addStarter(); reload(); };
  $('#wipe').onclick = async () => { await wipe(); reload(); };
}

// ---------------------------------------------------------------- backup
export async function downloadBackup() {
  try {
    const data = await db.exportAll(APP_VERSION);
    const ok = await saveFile(`spanish-vocab-backup-${dayKey(Date.now())}.json`, JSON.stringify(data, null, 1), 'application/json');
    if (!ok) return;
    state.lastBackup = Date.now();
    await setMeta('lastBackup', state.lastBackup);
    toast(`Backup created: ${data.counts.vocab} words · Đã sao lưu`, { type: 'success' });
  } catch (e) {
    toast('Backup failed: ' + e.message, { type: 'error' });
  }
}

function validate(data) {
  if (!data || data.app !== 'spanish-vocab' || !Array.isArray(data.vocab)) throw new Error('This file is not a Spanish Vocabulary backup.');
  if (data.schema > 1) throw new Error('This backup was made by a newer version of the app. Please update the app first.');
  for (const v of data.vocab) if (!v || typeof v.id !== 'string' || typeof v.es !== 'string') throw new Error('The backup contains an invalid vocabulary entry.');
  for (const s of ['cards', 'logs', 'imports']) if (data[s] !== undefined && !Array.isArray(data[s])) throw new Error(`The backup section “${s}” is damaged.`);
}

async function restoreFrom(file) {
  let data;
  try { data = JSON.parse(await file.text()); validate(data); }
  catch (e) { toast('Cannot restore: ' + e.message, { type: 'error', duration: 7000 }); return; }
  const existingIds = new Set(state.vocab.keys());
  const newWords = data.vocab.filter(v => !existingIds.has(v.id)).length;
  const sameIds = data.vocab.length - newWords;
  const mine = state.vocab.size;
  const choice = await modal({
    title: 'Restore backup · Khôi phục',
    body: `<p class="small">Backup from <b>${esc(fmtDate(Date.parse(data.exportedAt)))}</b>: ${data.vocab.length} words, ${(data.logs || []).length} review records.</p>
      <p class="small">On this device now: ${mine} words.</p>
      <p class="small"><b>Merge</b> (recommended): adds the ${newWords} words that are not here yet. Your current ${mine} words are kept unchanged${sameIds ? ` (${sameIds} matching words are skipped)` : ''}.<br>
      <b>Replace</b>: deletes everything on this device and loads the backup instead.</p>`,
    actions: [{ label: 'Cancel', value: null }, { label: 'Replace all…', value: 'replace', kind: 'danger' }, { label: 'Merge · Gộp', value: 'merge', kind: 'primary' }],
  });
  if (!choice) return;
  if (choice === 'replace' && mine > 0) {
    const sure = await confirmBox('Replace everything?', `This will permanently delete the ${mine} words and history currently on this device. Download a backup of the current data first if you might need it.<br><span class="vi">Toàn bộ dữ liệu hiện tại sẽ bị xóa.</span>`, 'Yes, replace', true);
    if (!sure) return;
  }
  try {
    const res = await db.importBackup(data, choice);
    await loadState();
    toast(`Restored: ${res.added.vocab} words added${res.skipped.vocab ? `, ${res.skipped.vocab} already here (kept)` : ''}.`, { type: 'success', duration: 6000 });
  } catch (e) {
    toast('Restore failed — your existing data was not changed. ' + e.message, { type: 'error', duration: 8000 });
  }
}

// ---------------------------------------------------------------- CSV
function csvCell(s) {
  const t = String(s ?? '');
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
async function exportCSV() {
  const words = activeVocab();
  if (!words.length) { toast('No vocabulary to export yet.'); return; }
  const cols = [['spanish', v => v.es], ['article', v => v.article], ['vietnamese', v => v.vi], ['english', v => v.en],
    ['part_of_speech', v => (posInfo(v.pos) || {}).en || ''], ['gender', v => v.gender], ['plural', v => v.plural],
    ['ipa', v => v.ipa], ['verb_info', v => v.verbInfo], ['adjective_forms', v => v.adjForms],
    ['example_es', v => v.exampleEs], ['example_en', v => v.exampleEn], ['example_vi', v => v.exampleVi],
    ['collocations', v => v.collocations], ['topic', v => v.topic], ['source', v => v.source], ['page', v => v.page],
    ['info_origin', v => v.infoOrigin], ['notes', v => v.notes], ['favorite', v => v.favorite ? 'yes' : ''],
    ['created', v => new Date(v.createdAt).toISOString()], ['id', v => v.id]];
  const lines = [cols.map(c => c[0]).join(','), ...words.map(v => cols.map(c => csvCell(c[1](v))).join(','))];
  // The BOM (﻿) makes Excel read Spanish and Vietnamese characters correctly.
  const ok = await saveFile(`spanish-vocab-${dayKey(Date.now())}.csv`, '﻿' + lines.join('\r\n'), 'text/csv');
  if (ok) toast(`Exported ${words.length} words to CSV`, { type: 'success' });
}

// ---------------------------------------------------------------- wipe
async function wipe() {
  const typed = await modal({
    title: 'Delete all data?',
    body: `<p class="small">This permanently deletes ${state.vocab.size} words and all review history from this device. It cannot be undone. Make a backup first.</p>
      <label class="fl"><span>Type DELETE to confirm · Gõ DELETE để xác nhận</span><input id="wipeConfirm" autocomplete="off" autocapitalize="characters"></label>`,
    actions: [{ label: 'Cancel', value: null }, { label: 'Delete everything', value: ov => ov.querySelector('#wipeConfirm').value.trim(), kind: 'danger' }],
  });
  if (typed === null) return;
  if (typed !== 'DELETE') { toast('Not deleted — the confirmation word did not match.'); return; }
  try { await db.wipeAll(); await loadState(); toast('All data deleted.'); }
  catch (e) { toast('Could not delete: ' + e.message, { type: 'error' }); }
}

// ---------------------------------------------------------------- starter words
const STARTER_SOURCE = 'Starter words (written by Claude AI — please verify)';
const STARTER = [
  { es: 'hola', pos: 'interjection', en: 'hello; hi', vi: 'xin chào', topic: 'Greetings & introductions',
    exampleEs: '¡Hola! ¿Cómo estás?', exampleEn: 'Hello! How are you?', exampleVi: 'Xin chào! Bạn khỏe không?' },
  { es: 'gracias', pos: 'interjection', en: 'thank you; thanks', vi: 'cảm ơn', topic: 'Greetings & introductions',
    exampleEs: 'Muchas gracias por tu ayuda.', exampleEn: 'Thank you very much for your help.', exampleVi: 'Cảm ơn bạn rất nhiều vì đã giúp đỡ.',
    collocations: 'muchas gracias (thank you very much) · gracias por… (thanks for…)' },
  { es: 'familia', article: 'la', gender: 'f', plural: 'familias', pos: 'noun', en: 'family', vi: 'gia đình', topic: 'Family & relationships',
    exampleEs: 'Mi familia es grande.', exampleEn: 'My family is big.', exampleVi: 'Gia đình tôi đông người.' },
  { es: 'agua', article: 'el', gender: 'f', plural: 'aguas (las aguas)', pos: 'noun', en: 'water', vi: 'nước', topic: 'Food & restaurants',
    exampleEs: 'Quiero un vaso de agua.', exampleEn: 'I want a glass of water.', exampleVi: 'Tôi muốn một ly nước.',
    notes: 'Feminine noun, but it uses “el” in the singular because it begins with a stressed “a”: el agua fría (adjective stays feminine). · Danh từ giống cái nhưng dùng “el” ở số ít.' },
  { es: 'comer', pos: 'verb', en: 'to eat', vi: 'ăn', topic: 'Food & restaurants',
    verbInfo: 'Regular -er verb. Present: como, comes, come, comemos, coméis, comen.',
    exampleEs: 'Nosotros comemos a las dos.', exampleEn: 'We eat at two o’clock.', exampleVi: 'Chúng tôi ăn lúc hai giờ.' },
  { es: 'libro', article: 'el', gender: 'm', plural: 'libros', pos: 'noun', en: 'book', vi: 'quyển sách; sách', topic: 'School & education',
    exampleEs: 'El libro está en la mesa.', exampleEn: 'The book is on the table.', exampleVi: 'Quyển sách ở trên bàn.' },
  { es: 'casa', article: 'la', gender: 'f', plural: 'casas', pos: 'noun', en: 'house; home', vi: 'nhà', topic: 'Home & places',
    exampleEs: 'Mi casa está cerca de aquí.', exampleEn: 'My house is near here.', exampleVi: 'Nhà tôi ở gần đây.',
    collocations: 'en casa (at home) · ir a casa (to go home)' },
  { es: 'hablar', pos: 'verb', en: 'to speak; to talk', vi: 'nói', topic: 'Conversations',
    verbInfo: 'Regular -ar verb. Present: hablo, hablas, habla, hablamos, habláis, hablan.',
    exampleEs: '¿Hablas español?', exampleEn: 'Do you speak Spanish?', exampleVi: 'Bạn có nói tiếng Tây Ban Nha không?' },
  { es: '¿Cuánto cuesta?', pos: 'phrase', en: 'How much does it cost?', vi: 'Giá bao nhiêu?', topic: 'Shopping & money',
    exampleEs: '¿Cuánto cuesta esta camisa?', exampleEn: 'How much does this shirt cost?', exampleVi: 'Cái áo sơ mi này giá bao nhiêu?',
    notes: 'For plural items: ¿Cuánto cuestan? · Nhiều món: ¿Cuánto cuestan?' },
  { es: 'bueno', pos: 'adjective', en: '1. good  2. tasty (food)', vi: '1. tốt  2. ngon (đồ ăn)', topic: 'Food & restaurants',
    adjForms: 'bueno, buena, buenos, buenas; “buen” before a masculine singular noun (un buen día).',
    exampleEs: 'La comida es muy buena.', exampleEn: 'The food is very good.', exampleVi: 'Đồ ăn rất ngon.' },
  { es: 'médico', article: 'el', gender: 'm', plural: 'médicos', pos: 'noun', en: 'doctor', vi: 'bác sĩ', topic: 'Health & appointments',
    exampleEs: 'Tengo una cita con el médico.', exampleEn: 'I have an appointment with the doctor.', exampleVi: 'Tôi có hẹn với bác sĩ.',
    notes: 'A female doctor: la médica. · Bác sĩ nữ: la médica.' },
  { es: 'llover', pos: 'verb', en: 'to rain', vi: 'mưa', topic: 'Weather & calendar',
    verbInfo: 'Stem-changing verb (o → ue). Mostly used in the 3rd person: llueve (it rains / it is raining).',
    exampleEs: 'Hoy llueve mucho.', exampleEn: 'It is raining a lot today.', exampleVi: 'Hôm nay trời mưa nhiều.' },
];

async function addStarter() {
  const have = new Set(activeVocab().map(v => keyOf(v.es)));
  const now = Date.now();
  const entries = STARTER.filter(s => !have.has(keyOf(s.es))).map((s, i) => ({
    ...blankEntry(), ...s, source: STARTER_SOURCE, infoOrigin: 'ai', createdAt: now + i, updatedAt: now,
  }));
  if (!entries.length) { toast('These words are already in your library.'); return; }
  try {
    await saveVocabBatch(entries);
    toast(`Added ${entries.length} starter words · Đã thêm ${entries.length} từ mẫu`, { type: 'success' });
  } catch (e) { toast('Could not add: ' + e.message, { type: 'error' }); }
}
