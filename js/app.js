// app.js — start-up, navigation, Home dashboard, Library, word details, add/edit form.
import { state, loadState, activeVocab, trashedVocab, blankEntry, saveVocab, deleteForever,
  getMeta, setMeta, delMeta, APP_VERSION } from './state.js';
import { statusOf, isDue, startOfDay, DAY } from './srs.js';
import { $, $$, esc, keyOf, fold, toast, modal, confirmBox, speak, fmtDate, fmtDue, dayKey, debounce } from './util.js';
import { POS, posInfo, TOPICS, topicVi, STATUS, ORIGINS, originInfo, ARTICLES, GENDERS,
  displayEs, displayEsHtml, isPhrase } from './labels.js';
import { renderPractice } from './practice.js';
import { renderImport } from './importer.js';
import { renderMore, backupReminderDue } from './more.js';
import { go, findDuplicates, accentBar, wireAccentBar, onRoute } from './nav.js';

const view = () => $('#view');

// ---------------------------------------------------------------- start-up
async function start() {
  try {
    await loadState();
  } catch (e) {
    view().innerHTML = `<div class="card error-card"><h2>Could not open your vocabulary database</h2>
      <p>${esc(e.message)}</p><p>Không thể mở dữ liệu. If you are in Private Browsing, switch to a normal tab.</p></div>`;
    return;
  }
  // Ask the browser to keep this site's data (no prompt in Safari; it decides by itself).
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist().catch(() => {}); }).catch(() => {});
  }
  window.addEventListener('hashchange', route);
  onRoute(route);
  document.addEventListener('vocab:saved', showSaved);
  route();
  registerServiceWorker();
}

let savedTimer;
function showSaved() {
  const el = $('#savedState');
  el.textContent = '✓ Saved · Đã lưu';
  el.classList.add('show');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => toast('A new version of the app is ready.', {
      action: { label: 'Update', fn: () => w.postMessage('SKIP_WAITING') } });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
  }).catch(err => console.warn('Service worker not registered:', err));
  // Reload only when an UPDATE takes over (not on the very first install), so the page
  // never refreshes while you are typing on your first visit.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return; reloaded = true; location.reload();
  });
}

// ---------------------------------------------------------------- routing
const TITLES = { home: 'Hoy · Today', library: 'Library · Thư viện', add: 'Add word · Thêm từ',
  practice: 'Practice · Luyện tập', more: 'More · Thêm', import: 'Import · Nhập từ' };


function route() {
  const [name, arg] = (location.hash.slice(1) || 'home').split('/');
  const tab = { word: 'library', edit: 'library', import: 'add' }[name] || name;
  $$('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  const back = $('#backBtn');
  back.hidden = !['word', 'edit', 'import'].includes(name);
  $('#title').textContent = TITLES[name] || (name === 'word' ? 'Word · Từ' : name === 'edit' ? 'Edit · Sửa' : 'Vocab ES');
  window.scrollTo(0, 0);
  const el = view();
  el.onclick = null;
  switch (name) {
    case 'home': return renderHome(el);
    case 'library': return renderLibrary(el);
    case 'word': return renderWord(el, arg);
    case 'add': return renderForm(el, null);
    case 'edit': return renderForm(el, arg);
    case 'practice': return renderPractice(el);
    case 'import': return renderImport(el);
    case 'more': return renderMore(el, { reload: route });
    default: location.hash = 'home';
  }
}

// ---------------------------------------------------------------- Home dashboard
function renderHome(el) {
  const now = Date.now();
  const words = activeVocab();
  const counts = { new: 0, learning: 0, reviewing: 0, learned: 0 };
  let due = 0;
  for (const v of words) {
    const c = state.cards.get(v.id);
    counts[statusOf(c)]++;
    if (isDue(c, now)) due++;
  }
  const wordIds = new Set(words.map(v => v.id));
  const recalled = new Set(state.logs.filter(l => l.correct && wordIds.has(l.vocabId)).map(l => l.vocabId)).size;
  const today0 = startOfDay(now);
  const introducedToday = [...state.cards.values()].filter(c => c.firstReviewed >= today0).length;
  const newAvailable = Math.min(counts.new, Math.max(0, state.settings.newPerDay - introducedToday));
  const addedThisWeek = words.filter(v => v.createdAt >= now - 7 * DAY).length;

  // Activity for the last 14 days
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(dayKey(today0 - i * DAY));
  const perDay = Object.fromEntries(days.map(d => [d, { n: 0, ok: 0 }]));
  for (const l of state.logs) { const k = dayKey(l.at); if (perDay[k]) { perDay[k].n++; if (l.correct) perDay[k].ok++; } }
  const maxN = Math.max(1, ...days.map(d => perDay[d].n));
  const week = state.logs.filter(l => l.at >= now - 7 * DAY);
  const acc = week.length ? Math.round(100 * week.filter(l => l.correct).length / week.length) : null;
  const studyDays = days.filter(d => perDay[d].n > 0).length;

  const difficult = words.map(v => ({ v, c: state.cards.get(v.id) }))
    .filter(x => x.c && x.c.lapses > 0).sort((a, b) => b.c.lapses - a.c.lapses).slice(0, 5);

  el.innerHTML = `
  ${words.length === 0 ? `
    <section class="card hero">
      <h2>¡Bienvenido! · Chào mừng!</h2>
      <p>Your vocabulary is saved only on this device. Start by adding your first word.</p>
      <p class="vi">Từ vựng của bạn chỉ được lưu trên thiết bị này. Hãy thêm từ đầu tiên.</p>
      <div class="row gap"><a class="btn primary" href="#add">+ Add a word</a>
      <a class="btn" href="#import">Import a list</a></div>
      <p class="small muted">Want to try the app first? Go to <a href="#more">More</a> → “Starter words”.</p>
    </section>` : `
    <section class="card hero">
      <div class="hero-num">${due + newAvailable}</div>
      <div><h2>${due + newAvailable ? 'Ready to review' : 'All caught up! ¡Muy bien!'}</h2>
      <p class="vi">${due} due for review · ${newAvailable} new today<br>${due} từ cần ôn · ${newAvailable} từ mới hôm nay</p></div>
      ${due + newAvailable ? `<a class="btn primary block" href="#practice" data-autostart="1" id="startReview">Start review · Bắt đầu ôn</a>` : ''}
    </section>`}
  ${backupReminderDue(words.length) ? `<a class="card notice" href="#more">💾 You have not made a backup recently. Tap to back up your vocabulary.<br><span class="vi">Bạn chưa sao lưu gần đây — chạm để sao lưu.</span></a>` : ''}
  <section class="stats">
    ${stat(words.length, 'Total words', 'Tổng số từ')}
    ${stat(counts.new, 'New', 'Từ mới')}
    ${stat(due, 'Due now', 'Cần ôn', due ? 'warn' : '')}
    ${stat(recalled, 'Recalled', 'Đã nhớ được')}
    ${stat(counts.learning + counts.reviewing, 'In progress', 'Đang học/ôn')}
    ${stat(counts.learned, 'Learned', 'Đã thuộc', 'good')}
  </section>
  <section class="card">
    <h3>Last 14 days · 14 ngày qua</h3>
    <div class="bars" role="img" aria-label="Reviews per day for the last 14 days">
      ${days.map(d => { const p = perDay[d]; const h = Math.round(100 * p.n / maxN);
        return `<div class="bar" title="${d}: ${p.n} answers, ${p.ok} correct"><span style="height:${h}%"></span><i>${Number(d.slice(8))}</i></div>`; }).join('')}
    </div>
    <p class="small muted">${studyDays} study days · ${week.length} answers this week${acc !== null ? ` · ${acc}% correct` : ''}<br>
    ${addedThisWeek} words added this week · ${addedThisWeek} từ mới thêm trong tuần</p>
  </section>
  ${difficult.length ? `<section class="card"><h3>Needs more practice · Cần luyện thêm</h3>
    <ul class="plain">${difficult.map(({ v, c }) => `<li><a href="#word/${v.id}">${displayEsHtml(v)}</a>
      <span class="muted"> — ${esc(v.vi || v.en)}</span> <span class="badge b-bad">✗ ${c.lapses}</span></li>`).join('')}</ul></section>` : ''}
  `;
  const sr = $('#startReview');
  if (sr) sr.addEventListener('click', () => sessionStorage.setItem('autostart', '1'));
}
const stat = (n, en, vi, cls = '') => `<div class="stat ${cls}"><b>${n}</b><span>${en}</span><span class="vi">${vi}</span></div>`;

// ---------------------------------------------------------------- Library
const lib = { q: '', section: 'all', pos: '', topic: '', status: '' };
const SECTIONS = [
  ['all', 'All · Tất cả'], ['recent', 'Recent · Mới thêm'], ['due', 'To review · Cần ôn'],
  ['fav', '★ Favorites'], ['learned', 'Learned · Đã thuộc'], ['phrases', 'Phrases · Cụm từ'],
  ['topics', 'Topics · Chủ đề'], ['trash', 'Trash · Thùng rác'],
];

function allTopics() {
  const set = new Set(TOPICS.map(t => t.en));
  activeVocab().forEach(v => v.topic && set.add(v.topic));
  return [...set];
}

function renderLibrary(el) {
  el.innerHTML = `
    <div class="searchbar"><input type="search" id="q" placeholder="Search ES / EN / VI… · Tìm kiếm" value="${esc(lib.q)}"
      autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search vocabulary"></div>
    <div class="chips" id="sections">${SECTIONS.map(([k, l]) =>
      `<button class="chip ${lib.section === k ? 'on' : ''}" data-s="${k}">${l}</button>`).join('')}</div>
    <div class="filters">
      <select id="fPos" aria-label="Part of speech"><option value="">All types · Mọi từ loại</option>
        ${POS.map(p => `<option value="${p.key}" ${lib.pos === p.key ? 'selected' : ''}>${p.en} · ${p.vi}</option>`).join('')}</select>
      <select id="fTopic" aria-label="Topic"><option value="">All topics · Mọi chủ đề</option>
        ${allTopics().map(t => `<option ${lib.topic === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <select id="fStatus" aria-label="Learning status"><option value="">Any status</option>
        ${Object.entries(STATUS).map(([k, s]) => `<option value="${k}" ${lib.status === k ? 'selected' : ''}>${s.en} · ${s.vi}</option>`).join('')}</select>
    </div>
    <div id="results"></div>`;
  const q = $('#q');
  q.addEventListener('input', debounce(() => { lib.q = q.value; drawResults(); }, 150));
  $('#sections').addEventListener('click', e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    lib.section = b.dataset.s; $$('#sections .chip').forEach(c => c.classList.toggle('on', c === b)); drawResults();
  });
  $('#fPos').onchange = e => { lib.pos = e.target.value; drawResults(); };
  $('#fTopic').onchange = e => { lib.topic = e.target.value; drawResults(); };
  $('#fStatus').onchange = e => { lib.status = e.target.value; drawResults(); };
  drawResults();
}

function filteredWords() {
  const now = Date.now();
  let list = lib.section === 'trash' ? trashedVocab() : activeVocab();
  const s = lib.section;
  if (s === 'recent') list = list.filter(v => v.createdAt >= now - 14 * DAY);
  if (s === 'due') list = list.filter(v => isDue(state.cards.get(v.id), now));
  if (s === 'fav') list = list.filter(v => v.favorite);
  if (s === 'learned') list = list.filter(v => statusOf(state.cards.get(v.id)) === 'learned');
  if (s === 'phrases') list = list.filter(isPhrase);
  if (lib.pos) list = list.filter(v => v.pos === lib.pos);
  if (lib.topic) list = list.filter(v => v.topic === lib.topic);
  if (lib.status) list = list.filter(v => statusOf(state.cards.get(v.id)) === lib.status);
  const q = fold(lib.q);
  if (q) {
    list = list.map(v => {
      const es = fold(v.es), full = fold(displayEs(v));
      let score = 0;
      if (es === q || full === q) score = 100;
      else if (es.startsWith(q)) score = 80;
      else if (es.includes(q) || full.includes(q)) score = 60;
      else if (fold(v.vi).includes(q) || fold(v.en).includes(q)) score = 40;
      else if ([v.exampleEs, v.notes, v.collocations, v.topic, v.source].some(f => fold(f).includes(q))) score = 10;
      return { v, score };
    }).filter(x => x.score).sort((a, b) => b.score - a.score).map(x => x.v);
  } else if (s === 'recent') list.sort((a, b) => b.createdAt - a.createdAt);
  else if (s === 'trash') list.sort((a, b) => b.deletedAt - a.deletedAt);
  else list.sort((a, b) => a.es.localeCompare(b.es, 'es', { sensitivity: 'base' }));
  return list;
}

function drawResults() {
  const box = $('#results');
  if (!box) return;
  if (lib.section === 'topics' && !lib.q) {
    const words = activeVocab();
    box.innerHTML = `<div class="topic-grid">${allTopics().map(t => {
      const n = words.filter(v => v.topic === t).length;
      return `<button class="topic" data-t="${esc(t)}"><b>${esc(t)}</b><span class="vi">${esc(topicVi(t))}</span><span class="count">${n} words</span></button>`;
    }).join('')}</div>`;
    box.onclick = e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      lib.topic = b.dataset.t; lib.section = 'all'; renderLibrary(view());
    };
    return;
  }
  box.onclick = null;
  const list = filteredWords();
  const total = list.length;
  const shown = list.slice(0, 300);
  box.innerHTML = `<p class="small muted count-line">${total} ${total === 1 ? 'word' : 'words'}${lib.section === 'trash' ? ' in trash · deleted words can be restored' : ''}</p>
    ${total === 0 ? `<div class="empty">${lib.q ? 'No matches. · Không tìm thấy.' : 'Nothing here yet. · Chưa có từ nào.'}
      ${lib.section !== 'trash' ? '<br><a class="btn primary" href="#add">+ Add a word</a>' : ''}</div>` : ''}
    <ul class="word-list">${shown.map(rowHtml).join('')}</ul>
    ${total > shown.length ? `<p class="small muted">Showing first 300. Use search to find more.</p>` : ''}`;
  if (lib.section === 'trash') {
    box.onclick = async e => {
      const b = e.target.closest('[data-restore],[data-purge]'); if (!b) return;
      e.preventDefault();
      if (b.dataset.restore) {
        const v = state.vocab.get(b.dataset.restore);
        try { await saveVocab({ ...v, deletedAt: null }); toast('Restored · Đã khôi phục', { type: 'success' }); drawResults(); }
        catch (err) { toast('Could not restore: ' + err.message, { type: 'error' }); }
      } else {
        const v = state.vocab.get(b.dataset.purge);
        if (await confirmBox('Delete forever?', `“${esc(displayEs(v))}” and its review history will be permanently removed. This cannot be undone.<br><span class="vi">Xóa vĩnh viễn, không thể khôi phục.</span>`, 'Delete forever', true)) {
          try { await deleteForever(v.id); toast('Deleted permanently'); drawResults(); }
          catch (err) { toast('Could not delete: ' + err.message, { type: 'error' }); }
        }
      }
    };
  }
}

function rowHtml(v) {
  const st = statusOf(state.cards.get(v.id));
  const p = posInfo(v.pos);
  const flag = v.infoOrigin === 'ai' || v.infoOrigin === 'uncertain' ? `<span class="badge b-warn" title="${esc(originInfo(v.infoOrigin).en)}">?</span>` : '';
  const trash = !!v.deletedAt;
  return `<li><a class="word-row" href="#word/${v.id}">
    <div class="wr-main"><div class="wr-es">${v.favorite ? '<span class="star">★</span>' : ''}${displayEsHtml(v)} ${p ? `<small>${p.abbr}</small>` : ''} ${flag}</div>
    <div class="wr-mean">${esc(v.vi)}${v.vi && v.en ? ' · ' : ''}<span class="muted">${esc(v.en)}</span></div></div>
    ${trash ? `<span class="row gap-s"><button class="btn small" data-restore="${v.id}">Restore</button><button class="btn small danger" data-purge="${v.id}">Delete</button></span>`
      : `<span class="badge st-${st}">${STATUS[st].en}</span>`}
  </a></li>`;
}

// ---------------------------------------------------------------- Word detail
function renderWord(el, id) {
  const v = state.vocab.get(id);
  if (!v) { el.innerHTML = `<div class="empty">This word was not found. <a href="#library">Back to library</a></div>`; return; }
  const c = state.cards.get(id);
  const st = statusOf(c);
  const p = posInfo(v.pos);
  const g = GENDERS.find(x => x.key === v.gender);
  const origin = originInfo(v.infoOrigin);
  const hist = state.logs.filter(l => l.vocabId === id).slice(-8).reverse();
  const field = (label, val) => val ? `<div class="field"><span class="lbl">${label}</span><div>${esc(val).replace(/\n/g, '<br>')}</div></div>` : '';
  el.innerHTML = `
  ${v.deletedAt ? `<div class="card notice">This word is in the Trash. <button class="btn small" id="restore">Restore</button></div>` : ''}
  <section class="card word-head">
    <div class="row between">
      <div><div class="big-es" lang="es">${displayEsHtml(v)}</div>
      ${p ? `<div class="pos">${esc(p.es)} · ${esc(p.en)} · ${esc(p.vi)}</div>` : ''}
      ${v.ipa ? `<div class="ipa">/${esc(v.ipa.replace(/^\/|\/$/g, ''))}/</div>` : ''}</div>
      <div class="col gap-s">
        <button class="icon-btn" id="speak" aria-label="Pronounce">🔊</button>
        <button class="icon-btn ${v.favorite ? 'on' : ''}" id="fav" aria-label="Favorite">${v.favorite ? '★' : '☆'}</button>
      </div>
    </div>
    <div class="meanings">
      <div><span class="lang">VI</span> ${esc(v.vi) || '<span class="muted">—</span>'}</div>
      <div><span class="lang">EN</span> ${esc(v.en) || '<span class="muted">—</span>'}</div>
    </div>
    <span class="badge ${['ai', 'uncertain'].includes(v.infoOrigin) ? 'b-warn' : 'b-info'}">${esc(origin.en)} · ${esc(origin.vi)}</span>
  </section>

  ${(v.gender || v.plural || v.verbInfo || v.adjForms) ? `<section class="card"><h3>Grammar · Ngữ pháp</h3>
    ${g && g.key ? field('Gender · Giống', `${g.en} (${g.vi})`) : ''}
    ${field('Plural · Số nhiều', v.plural)}
    ${field('Verb forms · Chia động từ', v.verbInfo)}
    ${field('Adjective forms · Dạng tính từ', v.adjForms)}</section>` : ''}

  ${v.exampleEs ? `<section class="card"><h3>Example · Ví dụ</h3>
    <p class="ex-es" lang="es">${esc(v.exampleEs)} <button class="icon-btn small" id="speakEx" aria-label="Pronounce example">🔊</button></p>
    ${v.exampleEn ? `<p class="ex-tr"><span class="lang">EN</span> ${esc(v.exampleEn)}</p>` : ''}
    ${v.exampleVi ? `<p class="ex-tr"><span class="lang">VI</span> ${esc(v.exampleVi)}</p>` : ''}</section>` : ''}

  ${(v.collocations || v.notes) ? `<section class="card"><h3>Usage & notes · Cách dùng</h3>
    ${field('Collocations & expressions · Cụm từ thường gặp', v.collocations)}
    ${field('Notes · Ghi chú', v.notes)}</section>` : ''}

  <section class="card"><h3>Source · Nguồn</h3>
    ${field('Topic · Chủ đề', v.topic ? `${v.topic}${topicVi(v.topic) ? ' · ' + topicVi(v.topic) : ''}` : '')}
    ${field('Source · Tài liệu', v.source)}
    ${field('Page · Trang', v.page)}
    ${field('Original text · Văn bản gốc', v.sourceText)}
    <p class="small muted">Added ${fmtDate(v.createdAt)} · Last edited ${fmtDate(v.updatedAt)}</p></section>

  <section class="card"><h3>Learning · Tiến độ</h3>
    <p><span class="badge st-${st}">${STATUS[st].en} · ${STATUS[st].vi}</span></p>
    ${c && c.reviews ? `<p class="small">Next review: <b>${fmtDue(c.due)}</b><br>Reviews: ${c.reviews} · Mistakes: ${c.lapses} · Successful in a row: ${c.streak}</p>` : '<p class="small muted">Not reviewed yet.</p>'}
    ${hist.length ? `<ul class="plain small">${hist.map(l => `<li>${fmtDate(l.at)} — ${esc(l.mode)} ${l.direction ? '(' + esc(l.direction) + ')' : ''}: ${l.correct ? '✓' : '✗'}${l.grade ? ' ' + esc(l.grade) : ''}</li>`).join('')}</ul>` : ''}
  </section>

  <div class="row gap actions-row">
    <a class="btn primary" href="#edit/${v.id}">✎ Edit · Sửa</a>
    ${v.deletedAt ? '' : `<button class="btn danger" id="del">Delete · Xóa</button>`}
  </div>`;

  $('#speak').onclick = () => speak(displayEs(v));
  const se = $('#speakEx'); if (se) se.onclick = () => speak(v.exampleEs);
  $('#fav').onclick = async () => {
    try { await saveVocab({ ...state.vocab.get(id), favorite: !v.favorite }); renderWord(el, id); }
    catch (e) { toast('Could not save: ' + e.message, { type: 'error' }); }
  };
  const del = $('#del');
  if (del) del.onclick = async () => {
    if (!await confirmBox('Move to Trash?', `“${esc(displayEs(v))}” will move to the Trash. You can restore it later, and its review history is kept.<br><span class="vi">Từ này sẽ vào Thùng rác; có thể khôi phục.</span>`, 'Move to Trash', true)) return;
    try {
      await saveVocab({ ...v, deletedAt: Date.now() });
      toast('Moved to Trash', { action: { label: 'Undo', fn: async () => { await saveVocab({ ...state.vocab.get(id), deletedAt: null }); go('word/' + id); } } });
      go('library');
    } catch (e) { toast('Could not delete: ' + e.message, { type: 'error' }); }
  };
  const rs = $('#restore');
  if (rs) rs.onclick = async () => { await saveVocab({ ...v, deletedAt: null }); renderWord(el, id); };
}

// ---------------------------------------------------------------- Add / Edit form
async function renderForm(el, id) {
  const existing = id ? state.vocab.get(id) : null;
  if (id && !existing) { el.innerHTML = `<div class="empty">Word not found.</div>`; return; }
  const draftKey = 'draft:' + (id || 'new');
  let v = existing ? { ...existing } : blankEntry();
  const draft = await getMeta(draftKey).catch(() => null);
  if (draft && draft.es !== undefined) {
    const ok = await confirmBox('Restore unsaved draft?', 'You have unfinished changes from before. Continue editing them?<br><span class="vi">Có bản nháp chưa lưu. Tiếp tục?</span>', 'Restore draft');
    if (ok) v = { ...v, ...draft, id: v.id };
    else await delMeta(draftKey).catch(() => {});
  }
  const sel = (name, opts, cur) => `<select name="${name}" id="f_${name}">${opts.map(([val, lab]) =>
    `<option value="${esc(val)}" ${val === (cur || '') ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  const inp = (name, label, opts = {}) => `<label class="fl"><span>${label}</span>
    ${opts.area ? `<textarea name="${name}" rows="${opts.rows || 2}" ${opts.lang ? `lang="${opts.lang}"` : ''} placeholder="${esc(opts.ph || '')}">${esc(v[name])}</textarea>`
      : `<input name="${name}" value="${esc(v[name])}" ${opts.lang ? `lang="${opts.lang}"` : ''} placeholder="${esc(opts.ph || '')}" autocomplete="off" ${opts.req ? 'required' : ''} ${opts.lang === 'es' ? 'autocapitalize="off" spellcheck="false"' : ''}>`}</label>`;

  el.innerHTML = `
  <form id="wordForm" class="form" novalidate>
    <section class="card">
      <h3>Word · Từ</h3>
      ${inp('es', 'Spanish word or phrase · Từ tiếng Tây Ban Nha *', { lang: 'es', req: true, ph: 'e.g. casa, ¿Cuánto cuesta?' })}
      ${accentBar()}
      <div id="dupWarn"></div>
      <div class="grid2">
        <label class="fl"><span>Part of speech · Từ loại</span>${sel('pos', [['', '—'], ...POS.map(p => [p.key, `${p.en} · ${p.vi}`])], v.pos)}</label>
        <label class="fl"><span>Topic · Chủ đề</span><input name="topic" list="topicList" value="${esc(v.topic)}" autocomplete="off"></label>
      </div>
      <datalist id="topicList">${allTopics().map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      ${inp('vi', 'Vietnamese meaning · Nghĩa tiếng Việt', { area: true, lang: 'vi' })}
      ${inp('en', 'English meaning · Nghĩa tiếng Anh', { area: true, lang: 'en' })}
      <p class="small muted">Tip: for several meanings, write each on its own line (1. … 2. …). · Nhiều nghĩa: mỗi nghĩa một dòng.</p>
    </section>

    <section class="card">
      <h3>Grammar & pronunciation · Ngữ pháp & phát âm</h3>
      <div class="grp grp-noun grid2">
        <label class="fl"><span>Article · Mạo từ</span>${sel('article', ARTICLES.map(a => [a, a || '—']), v.article)}</label>
        <label class="fl"><span>Gender · Giống</span>${sel('gender', GENDERS.map(gd => [gd.key, gd.key ? `${gd.en} · ${gd.vi}` : '—']), v.gender)}</label>
      </div>
      <div class="grp grp-noun">${inp('plural', 'Plural · Số nhiều', { lang: 'es', ph: 'e.g. casas' })}</div>
      <div class="grp grp-verb">${inp('verbInfo', 'Verb: infinitive, conjugation, irregular forms · Chia động từ', { area: true, rows: 3, lang: 'es', ph: 'e.g. Regular -ar. Present: hablo, hablas, habla, hablamos, habláis, hablan' })}</div>
      <div class="grp grp-adjective">${inp('adjForms', 'Adjective forms & agreement · Dạng tính từ', { lang: 'es', ph: 'e.g. bueno, buena, buenos, buenas' })}</div>
      ${inp('ipa', 'Pronunciation / IPA (only if reliable) · Phát âm', { ph: 'leave empty if unsure' })}
    </section>

    <section class="card">
      <h3>Example · Ví dụ</h3>
      ${inp('exampleEs', 'Spanish example sentence · Câu ví dụ', { area: true, lang: 'es' })}
      ${inp('exampleVi', 'Vietnamese translation · Dịch tiếng Việt', { area: true, lang: 'vi' })}
      ${inp('exampleEn', 'English translation · Dịch tiếng Anh', { area: true, lang: 'en' })}
      ${inp('collocations', 'Collocations & expressions · Cụm từ thường gặp', { area: true, lang: 'es' })}
    </section>

    <section class="card">
      <h3>Source & notes · Nguồn & ghi chú</h3>
      <div class="grid2">${inp('source', 'Source / document · Tài liệu')}${inp('page', 'Page · Trang')}</div>
      <label class="fl"><span>Where did this information come from? · Thông tin từ đâu?</span>
        ${sel('infoOrigin', ORIGINS.map(o => [o.key, `${o.en} · ${o.vi}`]), v.infoOrigin)}</label>
      ${inp('notes', 'Notes · Ghi chú', { area: true })}
      ${v.sourceText ? `<p class="small muted">Original source text (kept unchanged): <span lang="es">${esc(v.sourceText)}</span></p>` : ''}
    </section>

    <div class="sticky-actions row gap">
      <button type="button" class="btn" id="cancel">Cancel · Hủy</button>
      <button type="submit" class="btn primary grow">Save · Lưu</button>
    </div>
  </form>`;

  const form = $('#wordForm');
  const read = () => {
    const out = { ...v };
    for (const elx of form.elements) if (elx.name) out[elx.name] = elx.value.normalize('NFC').trim();
    return out;
  };
  const showGroups = () => {
    const pos = form.elements.pos.value;
    $$('.grp', form).forEach(gx => { gx.hidden = !(gx.classList.contains('grp-' + pos) || !pos); });
  };
  const checkDup = () => {
    const es = form.elements.es.value.trim();
    const box = $('#dupWarn');
    if (!es) { box.innerHTML = ''; return; }
    const { exact, similar } = findDuplicates(es, v.id);
    box.innerHTML = exact.length ? `<p class="warn-line">⚠ Already in your library: ${exact.map(x => `<a href="#word/${x.id}">${esc(displayEs(x))}</a>`).join(', ')}</p>`
      : similar.length ? `<p class="warn-line">Similar word (different accents): ${similar.map(x => `<a href="#word/${x.id}">${esc(displayEs(x))}</a>`).join(', ')} — check spelling.</p>` : '';
  };
  form.elements.pos.addEventListener('change', showGroups);
  form.elements.article.addEventListener('change', () => {
    const a = form.elements.article.value, gsel = form.elements.gender;
    if (!gsel.value && (a === 'la' || a === 'las')) gsel.value = 'f';
    if (!gsel.value && a === 'los') gsel.value = 'm';
    if (!gsel.value && a === 'el/la') gsel.value = 'mf';
    if (a && !form.elements.pos.value) { form.elements.pos.value = 'noun'; showGroups(); }
  });
  form.elements.es.addEventListener('input', debounce(checkDup, 250));
  showGroups(); checkDup();
  wireAccentBar(form);

  const saveDraft = debounce(() => setMeta(draftKey, read()).catch(() => {}), 600);
  form.addEventListener('input', saveDraft);

  $('#cancel').onclick = async () => {
    await delMeta(draftKey).catch(() => {});
    history.length > 1 ? history.back() : go('library');
  };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const out = read();
    if (!out.es) { toast('Please enter the Spanish word. · Vui lòng nhập từ tiếng Tây Ban Nha.', { type: 'error' }); form.elements.es.focus(); return; }
    if (!out.vi && !out.en) { toast('Please add a Vietnamese or English meaning. · Hãy thêm nghĩa.', { type: 'error' }); form.elements.vi.focus(); return; }
    if (!existing || keyOf(existing.es) !== keyOf(out.es)) {
      const { exact } = findDuplicates(out.es, v.id);
      if (exact.length) {
        const ok = await confirmBox('This word is already saved', `“${esc(displayEs(exact[0]))}” is already in your library${exact[0].vi ? ` (${esc(exact[0].vi)})` : ''}. Save another entry anyway? (Useful when the word has a different meaning.)<br><span class="vi">Từ này đã có. Vẫn lưu thêm?</span>`, 'Save anyway');
        if (!ok) return;
      }
    }
    try {
      const saved = await saveVocab(out);
      await delMeta(draftKey).catch(() => {});
      toast(existing ? 'Changes saved · Đã lưu thay đổi' : 'Word added · Đã thêm từ', { type: 'success' });
      if (existing) go('word/' + saved.id);
      else renderForm(el, null); // ready for the next word
    } catch (err) {
      toast('Could not save — your data was not changed. ' + err.message, { type: 'error' });
    }
  });
}

$('#backBtn').addEventListener('click', () => (history.length > 1 ? history.back() : go('library')));
// Tapping the tab you are already on reopens that screen (e.g. leaves a finished quiz).
$('.tabbar').addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
});
start();
