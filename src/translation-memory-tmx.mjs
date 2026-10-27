import { translateFromMemory } from './translation-memory.mjs';

const xmlEsc = s => {
  let out = '';
  for (const c of String(s)) {
    const cp = c.codePointAt(0);
    if (cp === 0x9 || cp === 0xA || cp === 0xD || (cp >= 0x20 && cp <= 0xD7FF) || (cp >= 0xE000 && cp <= 0xFFFD) || (cp >= 0x10000 && cp <= 0x10FFFF)) {
      out += c;
    } else {
      throw new RangeError('invalidUnicode');
    }
  }
  return out.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;').replace(/\n/g, '&#10;');
};

export function renderTranslationMemoryTmx(rows) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  rows = rows.slice();
  translateFromMemory(rows, { text: '__tmx_admission__', sourceLanguage: 'en', targetLanguage: 'lkt' });
  const enc = new TextEncoder();
  const chunks = [];
  let bytes = 0;
  const emit = chunk => {
    bytes += enc.encode(chunk).byteLength;
    if (bytes > 16777216) throw new RangeError('limit');
    chunks.push(chunk);
  };
  emit('<?xml version="1.0" encoding="UTF-8"?>\n<tmx version="1.4"><header creationtool="561-group-language-systems" creationtoolversion="1" segtype="sentence" o-tmf="RDF-SKOS" adminlang="en" srclang="*all*" datatype="PlainText"/><body>');

  const map = new Map();
  for (const r of rows) {
    const subj = typeof r.e === 'string' ? r.e : r.e ? r.e.value : undefined;
    const a = typeof r.a === 'string' ? r.a : r.a ? r.a.value : undefined;
    if (a !== 'http://www.w3.org/2004/02/skos/core#prefLabel') continue;
    const v = typeof r.v === 'string' ? r.v : r.v && r.v.kind === 'literal' ? r.v.value : undefined;
    if (!subj || v === undefined) continue;
    const l = (r.v && typeof r.v === 'object') ? r.v.language.toLowerCase() : '';
    if (!map.has(subj)) map.set(subj, new Map());
    let langMap = map.get(subj);
    if (!langMap.has(l)) langMap.set(l, new Map());
    let valMap = langMap.get(l);
    if (!valMap.has(v)) valMap.set(v, new Set());
    valMap.get(v).add(typeof r.t === 'string' ? r.t : '');
  }

  const subs = [...map.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  for (const [subj, langs] of subs) {
    emit(`<tu tuid="${xmlEsc(subj)}">`);
    const langArr = [...langs.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    for (const [lo, vals] of langArr) {
      const valArr = [...vals.entries()].sort((x, y) => x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0);
      for (const [val, wits] of valArr) {
        emit(`<tuv xml:lang="${xmlEsc(lo)}">`);
        for (const w of [...wits].sort().filter(Boolean)) emit(`<prop type="x-source">${xmlEsc(w)}</prop>`);
        emit(`<seg>${xmlEsc(val)}</seg></tuv>`);
      }
    }
    emit('</tu>');
  }
  emit('</body></tmx>');
  return chunks.join('');
}