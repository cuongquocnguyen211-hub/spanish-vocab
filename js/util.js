// util.js — small shared helpers (no data storage here).

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Keeps accents: used for exact duplicate detection ("año" ≠ "ano").
export function keyOf(s) {
  return String(s ?? '').normalize('NFC').toLowerCase()
    .replace(/[¿?¡!.,;:"“”«»()]/g, '').replace(/\s+/g, ' ').trim();
}
// Removes accents and Vietnamese tones: used for forgiving search ("cafe" finds "café").
export function fold(s) {
  return keyOf(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').normalize('NFC');
}

export function uid() {
  if (self.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDue(ts, now = Date.now()) {
  if (!ts) return '—';
  if (ts <= now) return 'Due now';
  const days = Math.round((ts - now) / 86400000);
  if (days <= 0) return 'Later today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days (${fmtDate(ts)})`;
}

// ---------- Toast messages ----------
let toastTimer;
export function toast(msg, { type = 'info', action = null, duration = 3200 } = {}) {
  const el = document.getElementById('toast');
  clearTimeout(toastTimer);
  el.className = `toast show t-${type}`;
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="toast-act">${esc(action.label)}</button>` : ''}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  if (action) el.querySelector('.toast-act').onclick = () => { el.className = 'toast'; action.fn(); };
  toastTimer = setTimeout(() => { el.className = 'toast'; }, action ? 10000 : (type === 'error' ? 6000 : duration));
}

// ---------- Modal dialog (returns a Promise) ----------
// actions: [{ label, value, kind }] — value may be a function(modalEl) to read inputs.
export function modal({ title, body = '', actions = [{ label: 'OK', value: true, kind: 'primary' }] }) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2><div class="modal-body">${body}</div>
      <div class="modal-actions">${actions.map((a, i) =>
        `<button type="button" class="btn ${a.kind || ''}" data-i="${i}">${a.label}</button>`).join('')}</div></div>`;
    const close = v => { ov.remove(); resolve(v); };
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-i]');
      if (b) { const a = actions[+b.dataset.i]; close(typeof a.value === 'function' ? a.value(ov) : a.value); }
      else if (e.target === ov) close(null);
    });
    document.body.append(ov);
    const first = ov.querySelector('input, select, textarea');
    if (first) setTimeout(() => first.focus(), 50);
  });
}

export function confirmBox(title, body, okLabel = 'Confirm', danger = false) {
  return modal({ title, body: `<p>${body}</p>`, actions: [
    { label: 'Cancel · Hủy', value: false },
    { label: okLabel, value: true, kind: danger ? 'danger' : 'primary' },
  ] });
}

// ---------- Save / share a file ----------
// On iPhone the Share sheet lets you "Save to Files"; on computers the file downloads.
// Returns false if the person cancelled.
export async function saveFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const coarse = matchMedia('(pointer: coarse)').matches;
  try {
    const file = new File([blob], filename, { type: mime });
    if (coarse && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
    // other share errors: fall back to a normal download
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

// ---------- Pronunciation using the device's own Spanish voice ----------
export function speak(text) {
  if (!('speechSynthesis' in self)) { toast('Speech is not supported on this browser.', { type: 'error' }); return; }
  const voices = speechSynthesis.getVoices();
  const voice = voices.find(v => /^es[-_]/i.test(v.lang) || v.lang === 'es');
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice ? voice.lang : 'es-ES';
  if (voice) u.voice = voice;
  u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  if (voices.length && !voice) toast('No Spanish voice found. On iPhone: Settings → Accessibility → Spoken Content → Voices → Spanish.', { duration: 6000 });
}

export function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
