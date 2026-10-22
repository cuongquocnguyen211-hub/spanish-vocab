// nav.js — navigation and helpers shared by several screens.
import { activeVocab } from './state.js';
import { keyOf, fold } from './util.js';
import { displayEs } from './labels.js';

let routeFn = () => {};
export function onRoute(fn) { routeFn = fn; }
export function go(hash) { if (location.hash === '#' + hash) routeFn(); else location.hash = hash; }

export function findDuplicates(es, exceptId) {
  const k = keyOf(es), f = fold(es);
  const exact = [], similar = [];
  for (const v of activeVocab()) {
    if (v.id === exceptId) continue;
    if (keyOf(v.es) === k || keyOf(displayEs(v)) === k) exact.push(v);
    else if (fold(v.es) === f || fold(displayEs(v)) === f) similar.push(v);
  }
  return { exact, similar };
}

// Spanish accent keys shown under Spanish text fields.
export function accentBar() {
  return `<div class="accent-bar" role="group" aria-label="Spanish characters">${['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡']
    .map(c => `<button type="button" tabindex="-1" data-ch="${c}">${c}</button>`).join('')}</div>`;
}
// Inserts accent characters into the last focused text field.
export function wireAccentBar(root) {
  let last = root.querySelector('input[lang="es"], textarea[lang="es"], input');
  root.addEventListener('focusin', e => { if (e.target.matches('input, textarea')) last = e.target; });
  root.addEventListener('pointerdown', e => { if (e.target.closest('[data-ch]')) e.preventDefault(); });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-ch]'); if (!b || !last) return;
    const s = last.selectionStart ?? last.value.length, en = last.selectionEnd ?? s;
    last.value = last.value.slice(0, s) + b.dataset.ch + last.value.slice(en);
    last.focus(); last.setSelectionRange(s + 1, s + 1);
    last.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
