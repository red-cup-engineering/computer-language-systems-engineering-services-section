// Source coordinate projection from the shared communicating engine's own
// articulation and settled reading. No retokenization, regex or guessed search.
// Coordinates are original-document UTF-16 code units, half-open.
const splitsSurrogate = (source, index) => index > 0 && index < source.length &&
  source.charCodeAt(index) >= 0xDC00 && source.charCodeAt(index) <= 0xDFFF &&
  source.charCodeAt(index - 1) >= 0xD800 && source.charCodeAt(index - 1) <= 0xDBFF;
const spanIsSourceExact = (source, span) =>
  span && Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end) &&
  span.start >= 0 && span.end > span.start && span.end <= source.length &&
  !splitsSurrogate(source, span.start) && !splitsSurrogate(source, span.end) &&
  typeof span.text === 'string' && source.slice(span.start, span.end) === span.text;

/** Bind parsed word occurrences to actual source coordinates only if *all*
 * tokens in this sentence match the language engine's native word
 * articulation in exact order. Repeated words are not collapsed to a name.
 * The source and grammar analyses may disagree; that is a withheld map,
 * never grounds for recovering offsets with an independent tokenizer.
 */
export function anchorNativeReading({ sourceText, sentenceSpan, articulatedSpans, parsedWords }) {
  if (typeof sourceText !== 'string' || !Array.isArray(articulatedSpans) ||
      !Array.isArray(parsedWords)) throw new TypeError('source, articulation and parsed words required');
  const withheld = (sourceSpan, reason) => ({ sourceSpan,
    wordSourceSpans: parsedWords.map(() => null),
    sourceBinding: 'withheld', sourceBindingReason: reason });
  if (!spanIsSourceExact(sourceText, sentenceSpan))
    return withheld(null, 'SENTENCE_NOT_SOURCE_EXACT');
  const sourceSpan = [sentenceSpan.start, sentenceSpan.end];
  const rawWords = articulatedSpans.filter(span => span?.tier === 'word' &&
    Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end) &&
    span.start >= sentenceSpan.start && span.end <= sentenceSpan.end);
  if (rawWords.length !== parsedWords.length)
    return withheld(sourceSpan, 'WORD_COUNT_MISMATCH');
  let previousEnd = sentenceSpan.start;
  const spans = [];
  for (let i = 0; i < parsedWords.length; i++) {
    const span = rawWords[i];
    if (!spanIsSourceExact(sourceText, span) || span.start < previousEnd ||
        span.end > sentenceSpan.end || typeof parsedWords[i]?.text !== 'string' ||
        span.text !== parsedWords[i].text)
      return withheld(sourceSpan, 'WORD_SOURCE_MISMATCH');
    spans.push([span.start, span.end]);
    previousEnd = span.end;
  }
  return { sourceSpan, wordSourceSpans: spans, sourceBinding: 'native-exact',
    sourceBindingReason: null };
}
