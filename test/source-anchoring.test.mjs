import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorNativeReading} from '../src/source-anchoring.mjs';
const span = (source, text, start, tier) => ({text,start,end:start+text.length,tier});
const words = (...texts) => texts.map(text=>({text}));
const map = (sourceText, sentenceSpan, articulatedSpans, parsedWords) =>
  anchorNativeReading({sourceText,sentenceSpan,articulatedSpans,parsedWords});

test('repeated words and sentences use engine coordinates, not first-occurrence search',()=>{
 const source='The cat saw the cat. The cat saw the cat.';
 const first={...span(source,'The cat saw the cat.',0,'sentence')};
 const second={...span(source,'The cat saw the cat.',21,'sentence')};
 const utteranceWords=['The','cat','saw','the','cat'];
 const sourceSpans=[0,4,8,12,16,21,25,29,33,37].map((start,i)=>
   span(source,utteranceWords[i%5],start,'word'));
 const f=map(source,first,sourceSpans,words(...utteranceWords));
 const s=map(source,second,sourceSpans,words(...utteranceWords));
 assert.equal(f.sourceBinding,'native-exact');assert.equal(s.sourceBinding,'native-exact');
 assert.deepEqual(f.wordSourceSpans,[[0,3],[4,7],[8,11],[12,15],[16,19]]);
 assert.deepEqual(s.wordSourceSpans,[[21,24],[25,28],[29,32],[33,36],[37,40]]);
});

test('source UTF-16 coordinate lengths include supplementary characters',()=>{
 const source='😀 The cat saw the cat.';
 const s=span(source,source,0,'sentence');
 const positions=[3,7,11,15,19],lexemes=['The','cat','saw','the','cat'];
 const spans=positions.map((pos,i)=>span(source,lexemes[i],pos,'word'));
 const result=map(source,s,spans,words(...lexemes));
 assert.equal(result.sourceBinding,'native-exact');
 assert.deepEqual(result.wordSourceSpans[0],[3,6]);
});

test('mismatched native parser/articulation counts refuse all word positions',()=>{
 const source='The cat saw the cat.';
 const sentence=span(source,source,0,'sentence');
 const out=map(source,sentence,[span(source,'The',0,'word')],words('The','cat'));
 assert.equal(out.sourceBinding,'withheld');
 assert.equal(out.sourceBindingReason,'WORD_COUNT_MISMATCH');
 assert.deepEqual(out.wordSourceSpans,[null,null]);
});

test('forged sentence substrings, offsets or source token text cannot earn coordinates',()=>{
 const source='The cat saw the cat.';
 const good=span(source,source,0,'sentence');
 const valid=[0,4,8,12,16].map((n,i)=>span(source,['The','cat','saw','the','cat'][i],n,'word'));
 for(const forged of [
   {...good,start:1}, {...good,text:'changed'}, {...good,end:source.length+1}
 ]) {
   const result=map(source,forged,valid,words('The','cat','saw','the','cat'));
   assert.equal(result.sourceBinding,'withheld');
   assert.equal(result.sourceSpan,null);
 }
 const badToken=valid.map(x=>({...x})); badToken[1].text='dog';
 const result=map(source,good,badToken,words('The','cat','saw','the','cat'));
 assert.equal(result.sourceBinding,'withheld');
 assert.equal(result.sourceBindingReason,'WORD_SOURCE_MISMATCH');
 assert.deepEqual(result.wordSourceSpans,[null,null,null,null,null]);
});

test('out-of-order duplicate tokens cannot claim source positions',()=>{
 const text='cat cat';const sentence=span(text,text,0,'sentence');
 const spans=[span(text,'cat',4,'word'),span(text,'cat',0,'word')];
 const result=map(text,sentence,spans,words('cat','cat'));
 assert.equal(result.sourceBinding,'withheld');
});

test('strict input and empty native word collections have determinate behavior',()=>{
 assert.throws(()=>anchorNativeReading({sourceText:null,articulatedSpans:[],parsedWords:[]}),/required/);
 const result=map('?!',{text:'?!',start:0,end:2,tier:'sentence'},[],[]);
 assert.equal(result.sourceBinding,'native-exact');
 assert.deepEqual(result.wordSourceSpans,[]);
});

test('UTF-16 spans that cut a surrogate pair are withheld, not made source coordinates',()=>{
 const source='😀 cat';const sentence=span(source,source,0,'sentence');
 const malformed=[{text:source.slice(1,2),start:1,end:2,tier:'word'}];
 const result=map(source,sentence,malformed,words(source.slice(1,2)));
 assert.equal(result.sourceBinding,'withheld');
 assert.equal(result.sourceBindingReason,'WORD_SOURCE_MISMATCH');
});
