import assert from 'node:assert/strict';
import test from 'node:test';
import {translateNumberedBatch, translateMandarin, translateMandarinToEnglish} from '@red-cup-engineering/computer-language-systems-engineering-services-section/translation';
import {translateCdramaZhEnEpisode, translateCdramaEnZhEpisode} from '@red-cup-engineering/computer-language-systems-engineering-services-section/episode-translation';

const request = {instruction:'Translate faithfully.',segments:['你好']};
const models = ['@cf/zai-org/glm-4.7-flash','@cf/qwen/qwen3.8-27b'];

test('real provider preflight denial permits only the alternative model admission', async () => {
 const denied=new Error('first model not authorized'), admitted=[], invoked=[];
 const result=await translateNumberedBatch(request,{AI:{async run(model){invoked.push(model);return {response:'[1] Hello'};}}},{authorize(effect){
  assert.ok(Object.isFrozen(effect));admitted.push(effect);if(effect.model===models[0])throw denied;
 }});
 assert.deepEqual(invoked,[models[1]]);assert.deepEqual(admitted.map(x=>x.model),models);
 assert.equal(result.attempts.length,2);assert.equal(result.attempts[0].submissionState,'not-submitted');
 assert.equal(result.attempts[0].effectAttempted,false);assert.equal(result.attempts[0].cause.cause,denied);
 assert.equal(result.attempts[0].effect,admitted[0]);assert.equal(result.attempts[1].outcome,'received-valid');
});

test('postinvoke capacity preserves original causal and effect evidence with exactly one model call', async () => {
 const original=new Error('capacity');let calls=0,effect;
 await assert.rejects(translateNumberedBatch(request,{AI:{async run(){calls++;throw original;}}},{authorize(e){effect=e;}}),error=>{
  assert.equal(error.code,'TRANSLATION_OUTCOME_UNCERTAIN');assert.equal(error.attemptScope,'numbered-batch');
  assert.equal(error.cause.cause,original);assert.equal(error.cause.effect,effect);
  assert.equal(error.cause.submissionState,'unreceived');assert.equal(error.cause.effectAttempted,true);
  assert.equal(error.attempts[0].cause,error.cause);assert.equal(error.attempts.length,1);return true;
 });assert.equal(calls,1);
});

test('null and unreadable received results stop without trying another model', async () => {
 for(const result of [null,undefined,{}, {get response(){throw new Error('cannot read result');}}]){
  let calls=0;
  await assert.rejects(translateNumberedBatch(request,{AI:{async run(){calls++;return result;}}}),error=>{
   assert.equal(error.attempts.length,1);assert.ok(['TRANSLATION_OUTCOME_UNCERTAIN','TRANSLATION_RESULT_UNREADABLE'].includes(error.code));return true;
  });assert.equal(calls,1);
 }
});

test('unclassified invocation failure is uncertain, not invented submission evidence',async()=>{
 const original=new Error('binding unavailable');let reads=0;
 const env={get AI(){reads++;throw original;}};
 await assert.rejects(translateNumberedBatch(request,env),error=>{
  assert.equal(error.cause,original);assert.equal(error.attempts[0].outcome,'uncertain');
  assert.equal(Object.hasOwn(error.attempts[0],'submissionState'),false);
  assert.equal(Object.hasOwn(error.attempts[0],'effectAttempted'),false);return true;
 });assert.equal(reads,1);
});

test('received short or echoed text retains semantic fallback without hiding its effect',async()=>{
 for(const first of ['', '[1] 你好']){
  let calls=0;const result=await translateNumberedBatch(request,{AI:{async run(){return {response:++calls===1?first:'[1] Hello'};}}});
  assert.equal(calls,2);assert.equal(result.targets[0],'Hello');assert.equal(result.attempts[0].outcome,'received-invalid');
  assert.equal(result.attempts[0].effectAttempted,true);assert.equal(result.attempts[0].submissionState,'received');
 }
});

test('mixed semantic failure then preflight denial does not claim batch non-submission',async()=>{
 let calls=0;
 await assert.rejects(translateNumberedBatch(request,{AI:{async run(){calls++;return {response:'[1] 你好'};}}},{authorize(e){if(e.model===models[1])throw new Error('denied');}}),error=>{
  assert.equal(error.code,'TRANSLATION_MODELS_EXHAUSTED');assert.equal(Object.hasOwn(error,'effectAttempted'),false);
  assert.deepEqual(error.attempts.map(x=>x.effectAttempted),[true,false]);return true;
 });assert.equal(calls,1);
});

test('private authorize options reach real provider from every public translation API',async()=>{
 const invocations=[
  (env,options)=>translateNumberedBatch(request,env,options),
  (env,options)=>translateMandarin({text:'你好'},env,'general',options),
  (env,options)=>translateMandarinToEnglish({text:'你好'},env,options),
  (env,options)=>translateCdramaZhEnEpisode({text:'你好'},env,options),
  (env,options)=>translateCdramaEnZhEpisode({text:'Hello'},env,options),
 ];
 for(const invoke of invocations){
  let calls=0,puts=0;const effects=[];
  const env={AI:{async run(){calls++;return {response:'[1] Hello'};}},CDRAMA_TRANSLATIONS:{async get(){return null;},async put(){puts++;}}};
  await assert.rejects(invoke(env,{authorize(effect){effects.push(effect);throw new Error('private denial');}}),error=>{
   assert.equal(error.code,'TRANSLATION_MODELS_EXHAUSTED');assert.ok(error.attempts.every(x=>x.submissionState==='not-submitted'&&x.effectAttempted===false));return true;
  });assert.deepEqual(effects.map(x=>x.model),models);assert.equal(calls,0);assert.equal(puts,0);
 }
});

test('episode uncertainty stops before any bucket put; body and environment hooks grant no authority',async()=>{
 let calls=0,puts=0,hooks=0;
 await assert.rejects(translateCdramaZhEnEpisode({text:'你好',authorize(){hooks++;}}, {
  authorize(){hooks++;},AI:{async run(){calls++;throw new Error('lost response');}},
  CDRAMA_TRANSLATIONS:{async get(){return null;},async put(){puts++;}},
 }),error=>error.code==='TRANSLATION_OUTCOME_UNCERTAIN');
 assert.equal(calls,1);assert.equal(puts,0);assert.equal(hooks,0);
});

test('invalid private authorization is rejected before a model effect',async()=>{
 let calls=0;
 await assert.rejects(translateNumberedBatch(request,{AI:{async run(){calls++;}}},{authorize:true}),/authorization must be a function/);
 assert.equal(calls,0);
});

test('a later-level uncertainty retains batch scope without implying earlier levels had no effects',async()=>{
 let calls=0;const failure=new Error('second level lost response');
 await assert.rejects(translateMandarinToEnglish({text:'你好',levels:['grammatical','natural']},{AI:{async run(){
  calls++;if(calls===1)return {response:'[1] Hello'};throw failure;
 }}}),error=>{
  assert.equal(error.attemptScope,'numbered-batch');assert.equal(error.attempts.length,1);
  assert.equal(error.cause.cause,failure);assert.equal(Object.hasOwn(error,'effectAttempted'),false);return true;
 });assert.equal(calls,2);
});
