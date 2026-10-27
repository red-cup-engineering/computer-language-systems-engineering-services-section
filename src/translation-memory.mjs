import { iri, isTerm, literal } from '@red-cup-engineering/computer-triplet-serialized-content-engineering-services-section/rdf-terms';

const PREF_LABEL_IRI = 'http://www.w3.org/2004/02/skos/core#prefLabel';
const snapshotCache = new WeakMap();

function codeUnitSort(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function validateIriTermOrString(termOrString) {
  if (typeof termOrString === 'string') {
    return iri(termOrString);
  }
  if (isTerm(termOrString) && termOrString.kind === 'iri') {
    return iri(termOrString.value);
  }
  throw new TypeError('Invalid IRI term or string');
}

export function admitTranslationMemoryRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TypeError('Body must be a plain object');
  }
  const keys = Object.keys(body);
  if (keys.length !== 3 || !Object.prototype.hasOwnProperty.call(body, 'text') || !Object.prototype.hasOwnProperty.call(body, 'sourceLanguage') || !Object.prototype.hasOwnProperty.call(body, 'targetLanguage')) {
    throw new TypeError('Request body must contain exactly OWN keys text/sourceLanguage/targetLanguage');
  }
  const { text, sourceLanguage, targetLanguage } = body;
  if (typeof text !== 'string' || text.trim().length === 0 || text.length > 4096) {
    throw new TypeError('text must be a non-blank string of at most 4096 UTF-16 code units');
  }
  if (typeof sourceLanguage !== 'string' || sourceLanguage.trim().length === 0) {
    throw new TypeError('sourceLanguage must be a non-empty string');
  }
  if (typeof targetLanguage !== 'string' || targetLanguage.trim().length === 0) {
    throw new TypeError('targetLanguage must be a non-empty string');
  }

  const normSource = literal('x', { language: sourceLanguage }).language;
  const normTarget = literal('x', { language: targetLanguage }).language;

  return {
    text,
    sourceLanguage: normSource,
    targetLanguage: normTarget
  };
}

function compileRows(rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError('rows must be an array');
  }
  if (rows.length > 10000) {
    throw new RangeError('rows array exceeds maximum limit of 10000');
  }

  const utf8Len = new TextEncoder().encode(JSON.stringify(rows)).byteLength;
  if (utf8Len > 16777216) {
    throw new RangeError('rows UTF-8 JSON size exceeds 16MiB limit');
  }

  // conceptIri -> Map<langTagLower, Map<labelValue, Set<witness>>>
  const concepts = new Map();
  // key: langTagLower + '\u0000' + labelValue -> Set<conceptIri>
  const labelLookup = new Map();

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      throw new TypeError('Invalid row item');
    }
    const { e, a, v, t } = row;
    const eIri = validateIriTermOrString(e);
    const aIri = validateIriTermOrString(a);

    if (!isTerm(v)) {
      throw new TypeError('v must be a valid RDF term');
    }
    if (typeof t !== 'string' || t.length === 0) {
      throw new TypeError('t must be a non-empty witness string');
    }

    if (aIri === PREF_LABEL_IRI) {
      if (v.kind !== 'literal' || !v.language) {
        throw new TypeError('prefLabel requires a language-tagged literal');
      }
      const normLang = literal(v.value, { language: v.language }).language;
      const labelValue = v.value;

      let conceptMap = concepts.get(eIri);
      if (!conceptMap) {
        conceptMap = new Map();
        concepts.set(eIri, conceptMap);
      }

      let langMap = conceptMap.get(normLang);
      if (!langMap) {
        langMap = new Map();
        conceptMap.set(normLang, langMap);
      }

      let witnessSet = langMap.get(labelValue);
      if (!witnessSet) {
        witnessSet = new Set();
        langMap.set(labelValue, witnessSet);
      }
      witnessSet.add(t);

      const lookupKey = JSON.stringify([normLang, labelValue]);
      let conceptSet = labelLookup.get(lookupKey);
      if (!conceptSet) {
        conceptSet = new Set();
        labelLookup.set(lookupKey, conceptSet);
      }
      conceptSet.add(eIri);
    }
  }

  return { concepts, labelLookup };
}

export function translateFromMemory(rows, body) {
  const req = admitTranslationMemoryRequest(body);

  let compiled = snapshotCache.get(rows);
  if (!compiled) {
    compiled = compileRows(rows);
    snapshotCache.set(rows, compiled);
  }

  const { concepts, labelLookup } = compiled;
  const lookupKey = JSON.stringify([req.sourceLanguage, req.text]);
  const matchedConceptIris = Array.from(labelLookup.get(lookupKey) || []).sort(codeUnitSort);

  let isContested = false;
  const candidates = [];

  for (const conceptIri of matchedConceptIris) {
    const conceptMap = concepts.get(conceptIri);

    const sourceLangMap = conceptMap ? conceptMap.get(req.sourceLanguage) : null;
    const targetLangMap = conceptMap ? conceptMap.get(req.targetLanguage) : null;

    if (sourceLangMap && sourceLangMap.size > 1) {
      isContested = true;
    }
    if (targetLangMap && targetLangMap.size > 1) {
      isContested = true;
    }

    const sourceLabels = [];
    if (sourceLangMap) {
      for (const [val, witnessSet] of sourceLangMap.entries()) {
        sourceLabels.push({
          value: val,
          language: req.sourceLanguage,
          witnesses: Array.from(witnessSet).sort(codeUnitSort)
        });
      }
      sourceLabels.sort((a, b) => codeUnitSort(a.value, b.value));
    }

    const targetLabels = [];
    if (targetLangMap) {
      for (const [val, witnessSet] of targetLangMap.entries()) {
        targetLabels.push({
          value: val,
          language: req.targetLanguage,
          witnesses: Array.from(witnessSet).sort(codeUnitSort)
        });
      }
      targetLabels.sort((a, b) => codeUnitSort(a.value, b.value));
    }

    candidates.push({
      conceptIri,
      sourceLabels,
      targetLabels
    });
  }

  let disposition;
  if (isContested) {
    disposition = 'contested';
  } else if (candidates.length > 1) {
    disposition = 'ambiguous';
  } else if (candidates.length === 0 || candidates.some(c => c.targetLabels.length === 0 || c.sourceLabels.length === 0)) {
    disposition = 'unresolved';
  } else {
    disposition = 'resolved';
  }

  return {
    method: 'translation-memory',
    inferenceUsed: false,
    disposition,
    sourceLanguage: req.sourceLanguage,
    targetLanguage: req.targetLanguage,
    candidates
  };
}
