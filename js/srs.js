// srs.js — spaced repetition (a simplified SM-2 schedule).
// Each word has one "card" with its own history; the vocabulary text is stored separately,
// so editing a word never resets its learning history.

export const DAY = 86400000;

export const GRADES = [
  { key: 'again', en: 'Incorrect', vi: 'Sai', cls: 'g-again' },
  { key: 'hard', en: 'Difficult', vi: 'Khó nhớ', cls: 'g-hard' },
  { key: 'good', en: 'Correct with effort', vi: 'Nhớ được', cls: 'g-good' },
  { key: 'easy', en: 'Easy', vi: 'Dễ', cls: 'g-easy' },
];

export function startOfDay(ts = Date.now()) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
}

export function newCard(vocabId) {
  return { vocabId, ease: 2.5, interval: 0, reps: 0, streak: 0, lapses: 0, reviews: 0,
    due: 0, lastReviewed: null, firstReviewed: null };
}

// Returns a NEW card object; does not modify the old one.
export function schedule(card, grade, now = Date.now()) {
  const c = { ...card };
  c.reviews += 1;
  c.lastReviewed = now;
  if (!c.firstReviewed) c.firstReviewed = now;

  if (grade === 'again') {
    c.lapses += 1; c.streak = 0; c.reps = 0; c.interval = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = now + 10 * 60 * 1000; // see it again in ~10 minutes
    return c;
  }
  if (grade === 'hard') {
    c.interval = c.interval < 1 ? 1 : Math.max(c.interval + 1, Math.round(c.interval * 1.2));
    c.ease = Math.max(1.3, c.ease - 0.15);
  } else if (grade === 'good') {
    c.interval = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.max(c.interval + 1, Math.round(c.interval * c.ease));
  } else if (grade === 'easy') {
    c.interval = c.reps === 0 ? 3 : Math.max(c.interval + 2, Math.round(c.interval * c.ease * 1.3));
    c.ease = c.ease + 0.15;
  } else {
    throw new Error('Unknown grade: ' + grade);
  }
  c.reps += 1;
  c.streak += 1;
  c.due = startOfDay(now) + c.interval * DAY; // due from the start of that day
  return c;
}

export function isDue(card, now = Date.now()) {
  return !!card && card.reviews > 0 && card.due <= now;
}

// Learning status is based on repeated performance, never on one answer.
// "learned" needs an interval of 3+ weeks AND at least 3 successful reviews in a row.
export function statusOf(card) {
  if (!card || !card.reviews) return 'new';
  if (card.interval >= 21 && card.streak >= 3) return 'learned';
  if (card.interval >= 3) return 'reviewing';
  return 'learning';
}

export function previewLabel(card, grade, now = Date.now()) {
  const c = schedule(card, grade, now);
  if (grade === 'again') return '10 min';
  const d = c.interval;
  if (d < 30) return d === 1 ? '1 day' : `${d} days`;
  const m = Math.round(d / 30);
  return m === 1 ? '1 month' : `${m} months`;
}
