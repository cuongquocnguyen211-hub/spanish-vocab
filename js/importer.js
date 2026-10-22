// importer.js — import vocabulary from pasted text, photos (via iPhone Live Text) and PDFs.
// Three separate steps: 1) get the text  2) proposed entries  3) your review & approval.
// Nothing is uploaded: photos and PDFs are only shown on this device.
import { state, blankEntry, saveVocabBatch, getMeta, setMeta, delMeta } from './state.js';
import { $, $$, esc, keyOf, fold, uid, toast, debounce } from './util.js';
import { POS, TOPICS, displayEs } from './labels.js';
import { findDuplicates, go } from './nav.js';

const ORDERS = {
  'es-vi-en': ['es', 'vi', 'en'],
  'es-en-vi': ['es', 'en', 'vi'],
  'es-vi': ['es', 'vi'],
  'es-en': ['es', 'en'],
  'es': ['es'],
};
const SPLIT = /\t|\s+[–—-]\s+|\s*[=|;]\s*|:\s+/;
const NUMBERING = /^\s*(\d+[.)]|[-•*·▪●])\s*/;
const ARTICLE = /^(el|la|los|las)\s+(.+)$/i;
const ODD = /[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s¿?¡!.,'’()/-]/;

let current = null; // { source, page, topic, rows: [...] }

export function parseText(text, order) {
  const fields = ORDERS[order] || ORDERS['es-vi-en'];
  const rows = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.normalize('NFC');
    const line = raw.replace(NUMBERING, '').trim();
    if (!line) continue;
    const parts = line.split(SPLIT).map(s => s.trim()).filter(Boolean);
    const r = { key: uid(), raw: raw.trim(), es: '', vi: '', en: '', article: '', gender: '', pos: '',
      suggested: [], flags: [], approved: true };
    fields.forEach((f, i) => { r[f] = parts[i] || ''; });
    if (parts.length > fields.length) r.flags.push('More parts than expected — check the columns');
    // Separate the article (el/la/los/las) — shown to you for review, never hidden.
    const m = r.es.match(ARTICLE);
    if (m) {
      r.article = m[1].toLowerCase(); r.es = m[2];
      r.gender = { la: 'f', las: 'f', el: 'm', los: 'm' }[r.article];
      r.pos = 'noun'; r.suggested.push('article', 'gender', 'pos');
    } else if (/^[a-záéíóúñ]+(ar|er|ir|arse|erse|irse)$/i.test(r.es) && r.es.length > 3) {
      r.pos = 'verb'; r.suggested.push('pos');
    } else if (/\s/.test(r.es)) {
      r.pos = 'phrase'; r.suggested.push('pos');
    }
    if (ODD.test(r.es)) r.flags.push('Unusual characters — check spelling (OCR error?)');
    if (r.es.length > 45) r.flags.push('Long text — is this one vocabulary item?');
    if (fields.length > 1 && !r.vi && !r.en) r.flags.push('No meaning found');
    rows.push(r);
  }
  markDuplicates(rows);
  return rows;
}

function markDuplicates(rows) {
  const seen = new Map();
  for (const r of rows) {
    r.dup = '';
    const full = r.article ? `${r.article} ${r.es}` : r.es;
    const { exact, similar } = findDuplicates(full);
    const d2 = exact.length ? exact : findDuplicates(r.es).exact;
    if (d2.length) { r.dup = 'exact'; r.dupWith = d2[0]; }
    else if (similar.length) { r.dup = 'similar'; r.dupWith = similar[0]; }
    const k = keyOf(r.es);
    if (k && seen.has(k)) r.dup = r.dup || 'batch';
    seen.set(k, true);
    if (r.dup === 'exact' || r.dup === 'batch') r.approved = false;
  }
}

export async function renderImport(el) {
  const draft = await getMeta('importDraft').catch(() => null) || {};
  el.innerHTML = `
  <section class="card">
    <h2>1 · Get the text · Lấy văn bản</h2>
    <div class="import-src">
      <label class="btn">📷 Photo / screenshot<input type="file" accept="image/*" id="imgIn" hidden></label>
      <label class="btn">📄 PDF<input type="file" accept="application/pdf" id="pdfIn" hidden></label>
    </div>
    <div id="srcPreview"></div>
    <details class="help"><summary>How to copy text from a photo or PDF · Cách sao chép chữ</summary>
      <ol class="small">
        <li><b>Photo:</b> choose the photo above. Press and hold on the words in the picture, drag to select, then tap <b>Copy</b> (iPhone “Live Text”, iOS 15+). Paste below.<br><span class="vi">Ảnh: nhấn giữ vào chữ trong ảnh, chọn, rồi bấm Sao chép. Dán vào ô bên dưới.</span></li>
        <li><b>PDF:</b> tap “Open PDF”, select the text, copy, and paste below. Scanned PDFs: take a screenshot, then use Live Text.<br><span class="vi">PDF: mở tệp, chọn chữ, sao chép và dán.</span></li>
        <li>Live Text runs on your iPhone; your photo is not uploaded anywhere by this app.</li>
      </ol></details>
    <label class="fl"><span>Paste or type your list — one word per line · Dán danh sách, mỗi dòng một từ</span>
      <textarea id="rawText" rows="8" lang="es" spellcheck="false" placeholder="la casa - nhà - house&#10;comer - ăn - to eat&#10;¿Cuánto cuesta? - Giá bao nhiêu? - How much is it?">${esc(draft.text || '')}</textarea></label>
    <div class="grid2">
      <label class="fl"><span>Column order · Thứ tự cột</span><select id="order">
        <option value="es-vi-en">Spanish – Vietnamese – English</option>
        <option value="es-en-vi">Spanish – English – Vietnamese</option>
        <option value="es-vi">Spanish – Vietnamese</option>
        <option value="es-en">Spanish – English</option>
        <option value="es">Spanish only · Chỉ tiếng TBN</option></select></label>
      <label class="fl"><span>Topic for this list · Chủ đề</span><input id="topic" list="impTopics" value="${esc(draft.topic || '')}" autocomplete="off"></label>
      <label class="fl"><span>Source / document name · Tên tài liệu</span><input id="source" value="${esc(draft.source || '')}" autocomplete="off"></label>
      <label class="fl"><span>Page · Trang</span><input id="page" value="${esc(draft.page || '')}" inputmode="numeric" autocomplete="off"></label>
    </div>
    <datalist id="impTopics">${TOPICS.map(t => `<option value="${esc(t.en)}">`).join('')}</datalist>
    <p class="small muted">Separators: tab, “ - ”, “ = ”, “ : ”, “|” or “;”. Numbering like “1.” is ignored.</p>
    <button class="btn primary block" id="analyze">2 · Show proposed entries · Xem đề xuất</button>
  </section>
  <div id="review"></div>`;

  if (draft.order) $('#order').value = draft.order;
  const saveDraft = debounce(() => $('#rawText') && setMeta('importDraft', {
    text: $('#rawText').value, order: $('#order').value, topic: $('#topic').value,
    source: $('#source').value, page: $('#page').value }).catch(() => {}), 500);
  el.querySelector('section').addEventListener('input', saveDraft);
  el.querySelector('section').addEventListener('change', saveDraft);

  $('#imgIn').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    $('#srcPreview').innerHTML = `<p class="small">Press and hold the text in the photo to select and copy it. · Nhấn giữ vào chữ để sao chép.</p>
      <img src="${url}" alt="Your photo" class="src-img">`;
    if (!$('#source').value) $('#source').value = f.name.replace(/\.[^.]+$/, '');
  };
  $('#pdfIn').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    $('#srcPreview').innerHTML = `<p class="small">PDF selected: <b>${esc(f.name)}</b>. <a class="btn small" href="${url}" target="_blank" rel="noopener">Open PDF</a><br>
      Copy the text from the PDF and paste it below. Remember to fill in the page number. · Nhớ ghi số trang.</p>`;
    $('#source').value = f.name.replace(/\.pdf$/i, '');
  };

  $('#analyze').onclick = () => {
    const text = $('#rawText').value;
    if (!text.trim()) { toast('Paste some text first. · Hãy dán văn bản trước.', { type: 'error' }); return; }
    current = { source: $('#source').value.trim(), page: $('#page').value.trim(), topic: $('#topic').value.trim(),
      text, rows: parseText(text, $('#order').value) };
    drawReview();
    $('#review').scrollIntoView({ behavior: 'smooth' });
  };
}

function drawReview() {
  const box = $('#review');
  const rows = current.rows;
  const nOk = rows.filter(r => r.approved).length;
  const posOpts = cur => `<option value="">—</option>${POS.map(p => `<option value="${p.key}" ${p.key === cur ? 'selected' : ''}>${p.en}</option>`).join('')}`;
  const sug = (r, f) => r.suggested.includes(f) ? 'suggested' : '';
  box.innerHTML = `
  <section class="card">
    <h2>3 · Review & approve · Kiểm tra & duyệt</h2>
    <p class="small">${rows.length} proposed · Yellow fields are suggestions made by the app, not from your source. Only checked entries are saved.<br>
    <span class="vi">Ô màu vàng là gợi ý của ứng dụng. Chỉ những mục được chọn mới được lưu.</span></p>
    <div class="row gap"><button class="btn small" id="allOn">Select all</button><button class="btn small" id="allOff">Select none</button></div>
  </section>
  ${rows.map((r, i) => `
  <section class="card imp-row ${r.approved ? '' : 'off'} ${r.flags.length || r.dup ? 'flagged' : ''}" data-i="${i}">
    <label class="check"><input type="checkbox" data-f="approved" ${r.approved ? 'checked' : ''}> Save this · Lưu mục này</label>
    <p class="small muted">Original: <span lang="es">${esc(r.raw)}</span></p>
    ${r.dup === 'exact' ? `<p class="warn-line">⚠ Already in your library: ${esc(displayEs(r.dupWith))} — ${esc(r.dupWith.vi || r.dupWith.en)}</p>` : ''}
    ${r.dup === 'similar' ? `<p class="warn-line">Similar word in library (accents differ): ${esc(displayEs(r.dupWith))}</p>` : ''}
    ${r.dup === 'batch' ? `<p class="warn-line">Repeated in this list</p>` : ''}
    ${r.flags.map(f => `<p class="warn-line">⚠ ${esc(f)}</p>`).join('')}
    <div class="grid3">
      <label class="fl"><span>Article</span><select data-f="article" class="${sug(r, 'article')}">${['', 'el', 'la', 'el/la', 'los', 'las'].map(a => `<option ${a === r.article ? 'selected' : ''} value="${a}">${a || '—'}</option>`).join('')}</select></label>
      <label class="fl span2"><span>Spanish · TBN</span><input data-f="es" lang="es" value="${esc(r.es)}" autocapitalize="off" spellcheck="false"></label>
    </div>
    <div class="grid2">
      <label class="fl"><span>Vietnamese · Việt</span><input data-f="vi" lang="vi" value="${esc(r.vi)}"></label>
      <label class="fl"><span>English · Anh</span><input data-f="en" lang="en" value="${esc(r.en)}"></label>
    </div>
    <label class="fl"><span>Part of speech · Từ loại</span><select data-f="pos" class="${sug(r, 'pos')}">${posOpts(r.pos)}</select></label>
  </section>`).join('')}
  <div class="sticky-actions row gap">
    <button class="btn" id="cancelImp">Cancel</button>
    <button class="btn primary grow" id="saveImp">Save ${nOk} approved · Lưu ${nOk} mục</button>
  </div>`;

  box.oninput = box.onchange = e => {
    const sec = e.target.closest('.imp-row'); if (!sec) return;
    const r = rows[+sec.dataset.i];
    const f = e.target.dataset.f;
    if (f === 'approved') { r.approved = e.target.checked; sec.classList.toggle('off', !r.approved); updateCount(); return; }
    if (f) { r[f] = e.target.value.normalize('NFC'); r.suggested = r.suggested.filter(x => x !== f); e.target.classList.remove('suggested'); }
    if (f === 'article' && !r.gender) r.gender = { la: 'f', las: 'f', el: 'm', los: 'm', 'el/la': 'mf' }[r.article] || '';
  };
  const updateCount = () => {
    const n = rows.filter(r => r.approved).length;
    $('#saveImp').textContent = `Save ${n} approved · Lưu ${n} mục`;
  };
  $('#allOn').onclick = () => { rows.forEach(r => (r.approved = true)); drawReview(); };
  $('#allOff').onclick = () => { rows.forEach(r => (r.approved = false)); drawReview(); };
  $('#cancelImp').onclick = () => { current = null; box.innerHTML = ''; };
  $('#saveImp').onclick = saveApproved;
}

async function saveApproved() {
  const approved = current.rows.filter(r => r.approved && r.es.trim());
  if (!approved.length) { toast('No entries selected. · Chưa chọn mục nào.', { type: 'error' }); return; }
  const now = Date.now();
  const rec = { id: uid(), at: now, name: current.source || 'Pasted list', page: current.page,
    topic: current.topic, count: approved.length, rawText: current.text };
  const entries = approved.map((r, i) => ({
    ...blankEntry(),
    es: r.es.trim(), vi: r.vi.trim(), en: r.en.trim(), article: r.article, gender: r.gender, pos: r.pos,
    topic: current.topic, source: current.source, page: current.page, sourceText: r.raw,
    infoOrigin: 'source', importId: rec.id, createdAt: now + i, updatedAt: now,
    notes: r.suggested.length ? `Suggested by app at import (please verify): ${r.suggested.join(', ')}` : '',
  }));
  try {
    await saveVocabBatch(entries, rec);
    await delMeta('importDraft').catch(() => {});
    toast(`${entries.length} words saved · Đã lưu ${entries.length} từ`, { type: 'success' });
    current = null;
    go('library');
  } catch (e) {
    toast('Import failed — nothing was saved. ' + e.message, { type: 'error', duration: 8000 });
  }
}
