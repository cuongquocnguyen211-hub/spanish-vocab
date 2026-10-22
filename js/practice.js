// practice.js — flashcard review (spaced repetition) and practice games.
import { state, activeVocab, recordReview, recordPractice, saveSettings } from './state.js';
import { isDue, statusOf, startOfDay, previewLabel, newCard, GRADES, DAY } from './srs.js';
import { $, $$, esc, fold, keyOf, shuffle, speak, toast } from './util.js';
import { posInfo, topicVi, GENDERS, displayEs, displayEsHtml } from './labels.js';
import { accentBar, wireAccentBar } from './nav.js';

const DIRS = {
  'es-vi': { label: 'Spanish → Vietnamese', short: 'ES → VI', from: 'es', to: 'vi' },
  'es-en': { label: 'Spanish → English', short: 'ES → EN', from: 'es', to: 'en' },
  'vi-es': { label: 'Vietnamese → Spanish', short: 'VI → ES', from: 'vi', to: 'es' },
  'en-es': { label: 'English → Spanish', short: 'EN → ES', from: 'en', to: 'es' },
  'mixed': { label: 'Mixed directions · Trộn', short: 'Mixed' },
};
const hasField = (v, f) => f === 'es' ? !!v.es : !!(v[f] && v[f].trim());
function pickDir(v, dir) {
  const options = dir === 'mixed' ? shuffle(['es-vi', 'es-en', 'vi-es', 'en-es']) : [dir, 'es-vi', 'es-en', 'vi-es', 'en-es'];
  return options.find(d => hasField(v, DIRS[d].from) && hasField(v, DIRS[d].to)) || 'es-vi';
}
const textOf = (v, f) => f === 'es' ? displayEs(v) : v[f];

// ------------------------------------------------------------ main screen
let lastScope = 'all';

export function renderPractice(el) {
  el.onclick = null;
  const now = Date.now();
  const words = activeVocab();
  const due = words.filter(v => isDue(state.cards.get(v.id), now));
  const introduced = [...state.cards.values()].filter(c => c.firstReviewed >= startOfDay(now)).length;
  const fresh = words.filter(v => statusOf(state.cards.get(v.id)) === 'new')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.max(0, state.settings.newPerDay - introduced));
  const topics = [...new Set(words.map(v => v.topic).filter(Boolean))].sort();
  const dirSelect = (id, cur, withMixed = true) => `<select id="${id}" aria-label="Direction">${Object.entries(DIRS)
    .filter(([k]) => withMixed || k !== 'mixed')
    .map(([k, d]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${d.label}</option>`).join('')}</select>`;

  el.innerHTML = `
  <section class="card">
    <h2>Spaced review · Ôn tập ngắt quãng</h2>
    <p>${due.length} due · ${fresh.length} new today <span class="vi">· ${due.length} từ cần ôn · ${fresh.length} từ mới</span></p>
    <label class="fl"><span>Direction · Chiều học</span>${dirSelect('srsDir', state.settings.direction)}</label>
    <button class="btn primary block" id="startSrs" ${due.length + fresh.length ? '' : 'disabled'}>
      ${due.length + fresh.length ? `Start review (${due.length + fresh.length}) · Bắt đầu` : 'Nothing to review now · Đã ôn xong'}</button>
    <p class="small muted">Your answers here decide when each word comes back. · Đánh giá của bạn quyết định khi nào từ được ôn lại.</p>
  </section>

  <section class="card">
    <h2>Practice games · Trò chơi luyện tập</h2>
    <p class="small muted">Results are saved to your history. They do not change the review schedule. · Kết quả được lưu vào lịch sử, không thay đổi lịch ôn.</p>
    <div class="grid2">
      <label class="fl"><span>Words · Từ vựng</span><select id="scope">
        <option value="all">All words · Tất cả (${words.length})</option>
        <option value="recent">Added in last 14 days · Mới thêm</option>
        <option value="due">Due for review · Cần ôn</option>
        <option value="difficult">Difficult words · Từ khó</option>
        <option value="fav">Favorites · Yêu thích</option>
        ${topics.map(t => `<option value="topic:${esc(t)}">${esc(t)}</option>`).join('')}
      </select></label>
      <label class="fl"><span>Direction · Chiều</span>${dirSelect('gameDir', state.settings.direction === 'mixed' ? 'es-vi' : state.settings.direction, false)}</label>
    </div>
    <div class="game-list">
      <button class="game" data-g="mc"><b>Multiple choice</b><span>Trắc nghiệm · 4 options</span></button>
      <button class="game" data-g="match"><b>Matching</b><span>Nối từ · 5 pairs</span></button>
      <button class="game" data-g="fill"><b>Fill in the blank</b><span>Điền vào chỗ trống · uses your example sentences</span></button>
    </div>
  </section>`;

  const scopeSel = $('#scope');
  if ([...scopeSel.options].some(o => o.value === lastScope)) scopeSel.value = lastScope;
  $('#srsDir').onchange = async e => { state.settings.direction = e.target.value; await saveSettings().catch(() => {}); };
  $('#startSrs').onclick = () => startReview(el, [...due, ...fresh], $('#srsDir').value);
  el.querySelector('.game-list').onclick = e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    lastScope = scopeSel.value;
    const pool = poolFor(scopeSel.value);
    const dir = $('#gameDir').value;
    if (b.dataset.g === 'mc') startMC(el, pool, dir);
    if (b.dataset.g === 'match') startMatch(el, pool, dir);
    if (b.dataset.g === 'fill') startFill(el, pool);
  };

  if (sessionStorage.getItem('autostart') && due.length + fresh.length) {
    sessionStorage.removeItem('autostart');
    startReview(el, [...due, ...fresh], state.settings.direction);
  }
}

function poolFor(scope) {
  const now = Date.now();
  const w = activeVocab();
  if (scope === 'recent') return w.filter(v => v.createdAt >= now - 14 * DAY);
  if (scope === 'due') return w.filter(v => isDue(state.cards.get(v.id), now));
  if (scope === 'difficult') return w.filter(v => (state.cards.get(v.id) || {}).lapses > 0);
  if (scope === 'fav') return w.filter(v => v.favorite);
  if (scope.startsWith('topic:')) return w.filter(v => v.topic === scope.slice(6));
  return w;
}

function topBar(i, n, label) {
  return `<div class="session-top"><button class="btn small" id="endSession">✕ End · Dừng</button>
    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${i}"><div style="width:${Math.round(100 * i / Math.max(1, n))}%"></div></div>
    <span class="small">${i}/${n}</span></div>${label ? `<p class="small muted center">${esc(label)}</p>` : ''}`;
}
function wireEnd(el, onEnd) { $('#endSession').onclick = onEnd || (() => renderPractice(el)); }

function answerDetails(v) {
  const p = posInfo(v.pos);
  const g = GENDERS.find(x => x.key === v.gender);
  return `<div class="answer">
    <div class="big-es" lang="es">${displayEsHtml(v)} <button class="icon-btn small" data-speak aria-label="Pronounce">🔊</button></div>
    ${p ? `<div class="pos">${esc(p.en)} · ${esc(p.vi)}${g && g.key ? ` · ${esc(g.en)}` : ''}${v.plural ? ` · pl. ${esc(v.plural)}` : ''}</div>` : ''}
    <div class="meanings"><div><span class="lang">VI</span> ${esc(v.vi) || '—'}</div><div><span class="lang">EN</span> ${esc(v.en) || '—'}</div></div>
    ${v.exampleEs ? `<p class="ex-es" lang="es">${esc(v.exampleEs)}</p>${v.exampleVi ? `<p class="ex-tr small">${esc(v.exampleVi)}</p>` : ''}${v.exampleEn ? `<p class="ex-tr small muted">${esc(v.exampleEn)}</p>` : ''}` : ''}
    ${v.verbInfo ? `<p class="small"><b>Verb:</b> ${esc(v.verbInfo)}</p>` : ''}
  </div>`;
}

// ------------------------------------------------------------ flashcard review (SRS)
function startReview(el, words, dir) {
  if (!words.length) { toast('Nothing to review right now.'); return; }
  const queue = words.map(v => ({ id: v.id, again: 0 }));
  const total = queue.length;
  let done = 0;
  const tally = { again: 0, hard: 0, good: 0, easy: 0 };

  const next = () => {
    if (!queue.length) return finish();
    const item = queue[0];
    const v = state.vocab.get(item.id);
    if (!v) { queue.shift(); return next(); }
    const d = pickDir(v, dir);
    const D = DIRS[d];
    const p = posInfo(v.pos);
    el.innerHTML = `${topBar(done, total, D.label)}
      <div class="flashcard" id="fc">
        <div class="front">
          ${D.from === 'es' ? `<div class="big-es" lang="es">${displayEsHtml(v)}</div>
            <button class="icon-btn" data-speak aria-label="Pronounce">🔊</button>`
          : `<div class="prompt-mean">${esc(v[D.from])}</div>
            <p class="small muted">${p ? esc(p.en) + ' · ' + esc(p.vi) + ' — ' : ''}What is it in Spanish? · Tiếng Tây Ban Nha là gì?</p>`}
          ${v.topic ? `<p class="small muted">${esc(v.topic)}</p>` : ''}
        </div>
        <div id="back"></div>
      </div>
      <button class="btn primary block big" id="reveal">Show answer · Xem đáp án</button>
      <div class="grades" id="grades" hidden></div>`;
    wireEnd(el, () => finish(true));
    el.onclick = e => { if (e.target.closest('[data-speak]')) speak(displayEs(v)); };
    $('#reveal').onclick = () => {
      $('#back').innerHTML = `<hr>${answerDetails(v)}`;
      $('#reveal').hidden = true;
      const card = state.cards.get(v.id) || newCard(v.id);
      const g = $('#grades');
      g.innerHTML = `<p class="small muted center">How well did you remember? · Bạn nhớ thế nào?</p>
        <div class="grade-grid">${GRADES.map(x => `<button class="btn grade ${x.cls}" data-grade="${x.key}">
          <b>${x.en}</b><span>${x.vi}</span><small>${previewLabel(card, x.key)}</small></button>`).join('')}</div>`;
      g.hidden = false;
      if (D.to === 'es') speak(displayEs(v));
    };
    $('#grades').onclick = async e => {
      const b = e.target.closest('[data-grade]'); if (!b || b.disabled) return;
      $$('#grades button').forEach(x => (x.disabled = true));
      const grade = b.dataset.grade;
      try {
        await recordReview(v.id, grade, d);
      } catch (err) {
        toast('Could not save this answer: ' + err.message, { type: 'error' });
        $$('#grades button').forEach(x => (x.disabled = false));
        return;
      }
      tally[grade]++;
      queue.shift();
      if (grade === 'again' && item.again < 2) { queue.push({ id: item.id, again: item.again + 1 }); }
      else done++;
      next();
    };
  };

  const finish = (early = false) => {
    el.onclick = null;
    const answered = tally.again + tally.hard + tally.good + tally.easy;
    el.innerHTML = `<section class="card center">
      <h2>${early ? 'Session ended' : '¡Terminado! · Hoàn thành!'}</h2>
      <p>${answered} answers saved · Đã lưu ${answered} câu trả lời</p>
      <div class="tally">
        ${GRADES.map(g => `<div class="${g.cls}"><b>${tally[g.key]}</b><span>${g.en}</span></div>`).join('')}
      </div>
      <p class="small muted">Words you marked “Incorrect” will come back soon. · Từ sai sẽ được ôn lại sớm.</p>
      <button class="btn primary" id="backPractice">Back · Quay lại</button></section>`;
    $('#backPractice').onclick = () => renderPractice(el);
  };
  next();
}

// ------------------------------------------------------------ multiple choice
function startMC(el, pool, dir) {
  const D = DIRS[dir];
  const eligible = pool.filter(v => hasField(v, D.from) && hasField(v, D.to));
  const allWithAnswer = activeVocab().filter(v => hasField(v, D.to));
  const distinctAnswers = new Set(allWithAnswer.map(v => fold(textOf(v, D.to))));
  if (eligible.length < 1 || distinctAnswers.size < 4) {
    toast(`Multiple choice needs at least 4 words with ${D.to === 'es' ? 'Spanish' : D.to === 'vi' ? 'Vietnamese' : 'English'} meanings. · Cần ít nhất 4 từ.`, { type: 'error' });
    return;
  }
  const questions = shuffle(eligible).slice(0, 10);
  const results = [];
  let i = 0;

  const ask = () => {
    if (i >= questions.length) return end();
    const v = questions[i];
    const right = textOf(v, D.to);
    const p = posInfo(v.pos);
    const others = shuffle(allWithAnswer.filter(o => o.id !== v.id && fold(textOf(o, D.to)) !== fold(right)));
    // Prefer distractors of the same part of speech, then fill with others.
    const same = others.filter(o => o.pos && o.pos === v.pos);
    const picked = [];
    for (const o of [...same, ...others]) {
      if (picked.length === 3) break;
      if (!picked.some(x => fold(textOf(x, D.to)) === fold(textOf(o, D.to)))) picked.push(o);
    }
    const options = shuffle([v, ...picked]);
    el.innerHTML = `${topBar(i, questions.length, D.label)}
      <div class="flashcard"><div class="front">
        ${D.from === 'es' ? `<div class="big-es" lang="es">${displayEsHtml(v)}</div>` : `<div class="prompt-mean">${esc(v[D.from])}</div>`}
        ${p ? `<p class="small muted">${esc(p.en)} · ${esc(p.vi)}</p>` : ''}
      </div></div>
      <div class="options">${options.map(o => `<button class="option" data-id="${o.id}" ${D.to === 'es' ? 'lang="es"' : ''}>${esc(textOf(o, D.to))}</button>`).join('')}</div>
      <div id="feedback"></div>`;
    wireEnd(el, end);
    el.querySelector('.options').onclick = e => {
      const b = e.target.closest('.option'); if (!b || el.querySelector('.options').dataset.done) return;
      el.querySelector('.options').dataset.done = '1';
      const ok = b.dataset.id === v.id;
      results.push({ vocabId: v.id, correct: ok });
      $$('.option', el).forEach(x => { if (x.dataset.id === v.id) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); x.disabled = true; });
      $('#feedback').innerHTML = `<p class="${ok ? 'ok-line' : 'bad-line'}">${ok ? '✓ Correct · Đúng rồi!' : '✗ Not quite · Chưa đúng'}</p>
        <div class="card">${answerDetails(v)}</div>
        <button class="btn primary block" id="nextQ">Next · Tiếp</button>`;
      $('#feedback').onclick = ev => { if (ev.target.closest('[data-speak]')) speak(displayEs(v)); };
      $('#nextQ').onclick = () => { i++; ask(); };
    };
  };
  const end = async () => {
    try { await recordPractice(results, 'multiple-choice', dir); } catch (e) { toast('Could not save results: ' + e.message, { type: 'error' }); }
    showScore(el, results, () => startMC(el, pool, dir));
  };
  ask();
}

function showScore(el, results, again) {
  const ok = results.filter(r => r.correct).length;
  const wrong = results.filter(r => !r.correct).map(r => state.vocab.get(r.vocabId)).filter(Boolean);
  el.onclick = null;
  el.innerHTML = `<section class="card center">
    <h2>${ok} / ${results.length}</h2><p>${results.length ? (ok === results.length ? '¡Perfecto! · Hoàn hảo!' : 'Keep practicing · Tiếp tục cố gắng!') : 'No answers saved.'}</p>
    ${wrong.length ? `<div class="left"><h3>Review these · Xem lại</h3><ul class="plain">${wrong.map(v => `<li><a href="#word/${v.id}">${displayEsHtml(v)}</a> — ${esc(v.vi || v.en)}</li>`).join('')}</ul></div>` : ''}
    <div class="row gap center-row"><button class="btn" id="backPractice">Back · Quay lại</button><button class="btn primary" id="again">Play again · Chơi lại</button></div>
  </section>`;
  $('#backPractice').onclick = () => renderPractice(el);
  $('#again').onclick = again;
}

// ------------------------------------------------------------ matching
function startMatch(el, pool, dir) {
  const D = DIRS[dir];
  const meaningField = D.from === 'es' ? D.to : D.from; // the non-Spanish side
  const eligible = pool.filter(v => v.es && hasField(v, meaningField));
  const picked = [];
  for (const v of shuffle(eligible)) {
    if (picked.length === 5) break;
    if (!picked.some(p => fold(p[meaningField]) === fold(v[meaningField]) || keyOf(p.es) === keyOf(v.es))) picked.push(v);
  }
  if (picked.length < 3) { toast('Matching needs at least 3 different words in this selection. · Cần ít nhất 3 từ.', { type: 'error' }); return; }
  const left = shuffle(picked), right = shuffle(picked);
  const missed = new Set();
  let selected = null, matched = 0;
  el.innerHTML = `${topBar(0, picked.length, 'Tap a Spanish word, then its meaning · Chạm từ rồi chạm nghĩa')}
    <div class="match">
      <div class="col">${left.map(v => `<button class="tile" data-side="L" data-id="${v.id}" lang="es">${esc(displayEs(v))}</button>`).join('')}</div>
      <div class="col">${right.map(v => `<button class="tile" data-side="R" data-id="${v.id}">${esc(v[meaningField])}</button>`).join('')}</div>
    </div>`;
  wireEnd(el);
  el.querySelector('.match').onclick = async e => {
    const t = e.target.closest('.tile'); if (!t || t.disabled) return;
    if (!selected || selected.dataset.side === t.dataset.side) {
      $$('.tile.sel', el).forEach(x => x.classList.remove('sel'));
      selected = t; t.classList.add('sel');
      if (t.dataset.side === 'L') speak(t.textContent);
      return;
    }
    if (selected.dataset.id === t.dataset.id) {
      [selected, t].forEach(x => { x.classList.remove('sel'); x.classList.add('right'); x.disabled = true; });
      matched++;
      const bar = el.querySelector('.progress div'); bar.style.width = `${Math.round(100 * matched / picked.length)}%`;
      el.querySelector('.session-top .small:last-child').textContent = `${matched}/${picked.length}`;
      if (matched === picked.length) {
        const results = picked.map(v => ({ vocabId: v.id, correct: !missed.has(v.id) }));
        try { await recordPractice(results, 'matching', dir); } catch (err) { toast('Could not save results: ' + err.message, { type: 'error' }); }
        setTimeout(() => showScore(el, results, () => startMatch(el, pool, dir)), 500);
      }
    } else {
      missed.add(selected.dataset.id); missed.add(t.dataset.id);
      const a = selected, b = t;
      [a, b].forEach(x => x.classList.add('wrong'));
      setTimeout(() => [a, b].forEach(x => x.classList.remove('wrong', 'sel')), 600);
    }
    selected = null;
  };
}

// ------------------------------------------------------------ fill in the blank
const LETTERS = 'a-zA-ZáéíóúüñÁÉÍÓÚÜÑ';
function blankRegex(word) {
  const map = { a: '[aá]', e: '[eé]', i: '[ií]', o: '[oó]', u: '[uúü]', n: '[nñ]' };
  const body = word.normalize('NFC').split('').map(ch => {
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (map[base]) return map[base];
    return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return new RegExp(`(^|[^${LETTERS}])(${body})(?![${LETTERS}])`, 'i');
}

function startFill(el, pool) {
  const items = [];
  for (const v of shuffle(pool)) {
    if (!v.exampleEs || !v.es) continue;
    const m = v.exampleEs.normalize('NFC').match(blankRegex(v.es.replace(/^[¿¡]|[?!]$/g, '')));
    if (m) items.push({ v, m });
    if (items.length === 10) break;
  }
  if (!items.length) {
    toast('Fill-in-the-blank needs words whose example sentence contains the exact word. Add example sentences first. · Cần câu ví dụ có chứa từ.', { type: 'error', duration: 6000 });
    return;
  }
  const results = [];
  let i = 0;
  const ask = () => {
    if (i >= items.length) return end();
    const { v, m } = items[i];
    const sentence = v.exampleEs.normalize('NFC');
    const start = m.index + m[1].length;
    const answer = m[2];
    const blanked = esc(sentence.slice(0, start)) + '<span class="blank">_____</span>' + esc(sentence.slice(start + answer.length));
    el.innerHTML = `${topBar(i, items.length, 'Type the missing Spanish word · Điền từ còn thiếu')}
      <div class="flashcard"><div class="front left">
        <p class="ex-es big-sentence" lang="es">${blanked}</p>
        ${v.exampleVi ? `<p class="small"><span class="lang">VI</span> ${esc(v.exampleVi)}</p>` : ''}
        ${v.exampleEn ? `<p class="small muted"><span class="lang">EN</span> ${esc(v.exampleEn)}</p>` : ''}
        <p class="small muted">Hint · Gợi ý: ${esc(v.vi || v.en)}</p>
      </div></div>
      <form id="fillForm" class="form">
        <input id="fillIn" lang="es" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Your answer · Câu trả lời" aria-label="Your answer">
        ${accentBar()}
        <button class="btn primary block" type="submit">Check · Kiểm tra</button>
      </form><div id="feedback"></div>`;
    wireEnd(el, end);
    const form = $('#fillForm');
    wireAccentBar(form);
    $('#fillIn').focus();
    form.onsubmit = e => {
      e.preventDefault();
      const given = $('#fillIn').value.normalize('NFC').trim();
      if (!given) return;
      const exact = given.toLowerCase() === answer.toLowerCase();
      const almost = !exact && fold(given) === fold(answer);
      results.push({ vocabId: v.id, correct: exact });
      form.querySelector('button[type=submit]').disabled = true;
      $('#fillIn').disabled = true;
      $('#feedback').innerHTML = `<p class="${exact ? 'ok-line' : 'bad-line'}">${exact ? '✓ Correct · Đúng rồi!'
        : almost ? `Almost! Check the accents: <b lang="es">${esc(answer)}</b> · Gần đúng — chú ý dấu.`
        : `✗ The answer is <b lang="es">${esc(answer)}</b>`}</p>
        <p class="ex-es" lang="es">${esc(sentence)} <button class="icon-btn small" data-speak aria-label="Pronounce sentence">🔊</button></p>
        <button class="btn primary block" id="nextQ">Next · Tiếp</button>`;
      $('#feedback').onclick = ev => { if (ev.target.closest('[data-speak]')) speak(sentence); };
      $('#nextQ').onclick = () => { i++; ask(); };
    };
  };
  const end = async () => {
    try { await recordPractice(results, 'fill-in', 'es'); } catch (e) { toast('Could not save results: ' + e.message, { type: 'error' }); }
    showScore(el, results, () => startFill(el, pool));
  };
  ask();
}
