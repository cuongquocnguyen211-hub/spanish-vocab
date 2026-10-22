// labels.js — three-language labels for parts of speech, topics, status, information origin.
import { esc } from './util.js';

export const POS = [
  { key: 'noun', es: 'sustantivo', en: 'noun', vi: 'danh từ', abbr: 'n.' },
  { key: 'verb', es: 'verbo', en: 'verb', vi: 'động từ', abbr: 'v.' },
  { key: 'adjective', es: 'adjetivo', en: 'adjective', vi: 'tính từ', abbr: 'adj.' },
  { key: 'adverb', es: 'adverbio', en: 'adverb', vi: 'trạng từ', abbr: 'adv.' },
  { key: 'pronoun', es: 'pronombre', en: 'pronoun', vi: 'đại từ', abbr: 'pron.' },
  { key: 'preposition', es: 'preposición', en: 'preposition', vi: 'giới từ', abbr: 'prep.' },
  { key: 'conjunction', es: 'conjunción', en: 'conjunction', vi: 'liên từ', abbr: 'conj.' },
  { key: 'article', es: 'artículo', en: 'article', vi: 'mạo từ', abbr: 'art.' },
  { key: 'number', es: 'número', en: 'number', vi: 'số từ', abbr: 'num.' },
  { key: 'interjection', es: 'interjección', en: 'interjection', vi: 'thán từ', abbr: 'interj.' },
  { key: 'phrase', es: 'expresión / frase', en: 'phrase / expression', vi: 'cụm từ / thành ngữ', abbr: 'phr.' },
];
export const posInfo = k => POS.find(p => p.key === k);

export const TOPICS = [
  { en: 'Greetings & introductions', vi: 'Chào hỏi & giới thiệu' },
  { en: 'Family & relationships', vi: 'Gia đình & các mối quan hệ' },
  { en: 'School & education', vi: 'Trường học & giáo dục' },
  { en: 'Food & restaurants', vi: 'Đồ ăn & nhà hàng' },
  { en: 'Shopping & money', vi: 'Mua sắm & tiền bạc' },
  { en: 'Weather & calendar', vi: 'Thời tiết & lịch' },
  { en: 'Transportation & travel', vi: 'Đi lại & du lịch' },
  { en: 'Work & daily activities', vi: 'Công việc & sinh hoạt hằng ngày' },
  { en: 'Health & appointments', vi: 'Sức khỏe & cuộc hẹn' },
  { en: 'Conversations', vi: 'Hội thoại' },
  { en: 'Home & places', vi: 'Nhà cửa & địa điểm' },
];
export const topicVi = t => (TOPICS.find(x => x.en === t) || {}).vi || '';

export const STATUS = {
  new: { en: 'New', vi: 'Mới' },
  learning: { en: 'Learning', vi: 'Đang học' },
  reviewing: { en: 'Reviewing', vi: 'Đang ôn' },
  learned: { en: 'Learned', vi: 'Đã thuộc' },
};

export const ORIGINS = [
  { key: 'source', en: 'From my book/document', vi: 'Từ tài liệu gốc' },
  { key: 'verified', en: 'Checked in a dictionary', vi: 'Đã kiểm tra từ điển' },
  { key: 'manual', en: 'My own entry', vi: 'Tự nhập' },
  { key: 'ai', en: 'AI suggestion — please verify', vi: 'Gợi ý AI — cần kiểm tra' },
  { key: 'uncertain', en: 'Uncertain', vi: 'Chưa chắc chắn' },
];
export const originInfo = k => ORIGINS.find(o => o.key === k) || ORIGINS[2];

export const ARTICLES = ['', 'el', 'la', 'el/la', 'los', 'las'];
export const GENDERS = [
  { key: '', en: '—', vi: '' },
  { key: 'm', en: 'masculine', vi: 'giống đực' },
  { key: 'f', en: 'feminine', vi: 'giống cái' },
  { key: 'mf', en: 'masc. & fem.', vi: 'cả hai giống' },
];

export function displayEs(v) {
  return v.article ? `${v.article} ${v.es}` : v.es;
}
export function displayEsHtml(v) {
  return v.article ? `<span class="art">${esc(v.article)}</span> ${esc(v.es)}` : esc(v.es);
}
export function isPhrase(v) {
  return v.pos === 'phrase' || /\s/.test((v.es || '').trim());
}
