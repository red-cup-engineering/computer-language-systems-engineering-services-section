// Native receiver for the shared tagging implementation, against the actual
// English bundle mount. Unlike isolated coordinate fixtures, this exercises
// communicating's articulation, settlement, parser and tag projection.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTag} from '../scripts/tag.mjs';
import {rawBundle} from '../services/english-language-algebra/src/bundle.mjs';

const {tagText}=createTag(rawBundle);

test('native settlement returns exact source coordinates for repeated sentences and word occurrences',()=>{
 const clause='The teacher graded the exam.';
 const source=clause+' '+clause;
 const r=tagText(source);
 assert.equal(r.sentences.length,2);
 const starts=[0,clause.length+1];
 for(let i=0;i<2;i++){
   const s=r.sentences[i];
   assert.equal(s.sourceBinding,'native-exact',JSON.stringify(s.sourceBindingReason));
   assert.deepEqual(s.sourceSpan,[starts[i],starts[i]+clause.length]);
   assert.equal(s.wordSourceSpans.length,s.words.length);
   for(let j=0;j<s.words.length;j++){
     const [a,b]=s.wordSourceSpans[j];
     assert.equal(source.slice(a,b),s.words[j].text);
     assert.ok(a>=s.sourceSpan[0]&&b<=s.sourceSpan[1]);
   }
 }
 assert.notDeepEqual(r.sentences[0].wordSourceSpans,r.sentences[1].wordSourceSpans);
});

test('native UTF-16 offsets survive an astral character before a prose sentence',()=>{
 const source='😀 The teacher graded the exam.';
 const r=tagText(source);
 assert.equal(r.sentences.length,1);
 const s=r.sentences[0];
 assert.equal(s.sourceBinding,'native-exact',JSON.stringify(s.sourceBindingReason));
 for(let i=0;i<s.words.length;i++){
   const [a,b]=s.wordSourceSpans[i];
   assert.equal(source.slice(a,b),s.words[i].text);
 }
 const teacher=s.words.findIndex(w=>w.text==='teacher');
 assert.ok(teacher>=0);
 assert.equal(s.wordSourceSpans[teacher][0],source.indexOf('teacher'));
});
