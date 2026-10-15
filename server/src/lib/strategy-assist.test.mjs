import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStrategyAssist,certifyFrictionEnabled} from './strategy-assist.js';
import {buildClaimLedger} from './claim-ledger.js';
import {buildStewardCopilot} from './steward-copilot.js';
const payload={identity:{positioning:'Artisanal cheesecake for everyday celebrations',pillars:['Joyful indulgence','Artisanal quality']},audience:{primary:'Friends sharing a small celebration'},goals:{northStar:'Open ten neighbourhood stores'},voice:{register:'Joyful'},visual:{palette:[{hex:'#FFCC00',role:'primary'}]},confidence:{'identity.positioning':{conf:95,source:'brand-deck.pdf'},'audience.primary':{conf:90,source:'brand-deck.pdf'},'goals.northStar':{conf:55,source:'brand-deck.pdf'}},evidence:{'identity.positioning':{sourceId:'deck',quote:'Artisanal cheesecake for everyday celebrations'},'audience.primary':{sourceId:'deck',quote:'Friends sharing a small celebration'},'goals.northStar':{sourceId:'deck',quote:'Open ten neighbourhood stores'}}};
const sources=[{id:'deck',kind:'file_upload',src:'brand-deck.pdf',evidence_url:'https://files.test/signed/deck.pdf',signals:{}}];
const bio={id:'bio',version:3,payload};
function fixture(nextPayload=payload){return {job:{id:'job',brand_id:'cake'},bio:{...bio,payload:nextPayload},sources,claims:buildClaimLedger({brandId:'cake',bioVersion:3,payload:nextPayload,sources}).claims};}
const find=(projection,path)=>projection.claims.find(claim=>claim.field_path===path);
test('flag defaults off and old copilot contract is unchanged',()=>{
 const value=process.env.CERTIFY_FRICTION;delete process.env.CERTIFY_FRICTION;try{assert.equal(certifyFrictionEnabled(),false);assert.equal(Object.hasOwn(buildStewardCopilot({bio}),'strategyAssist'),false);}finally{if(value===undefined)delete process.env.CERTIFY_FRICTION;else process.env.CERTIFY_FRICTION=value;}
});
test('strategy assessment cites only actual claim/source IDs, recorded excerpts and signed source URLs',()=>{
 const result=buildStrategyAssist(fixture()),position=find(result,'identity.positioning');
 assert.equal(result.jobId,'job');assert.equal(result.bioVersion,3);assert.equal(position.recommendation,'accept');assert.equal(position.reasonCode,'supported');assert.equal(position.citations[0].source_id,'deck');assert.equal(position.citations[0].claim_id,position.claim_id);assert.equal(position.citations[0].quote,payload.evidence['identity.positioning'].quote);assert.equal(position.citations[0].asset_url,sources[0].evidence_url);assert.match(position.assessment.en,/Artisanal cheesecake/);assert.match(position.assessment.en,/reason to choose/);assert.match(position.question.en,/alternatives\?/);
 assert.ok(result.claims.every(claim=>!/^visual\.|^voice\./.test(claim.field_path)));assert.ok(find(result,'strategic.watchouts'),'Strategic guideline fields remain covered');
});
test('unsupported, missing and low-confidence claims request a human instead of certifying',()=>{
 const result=buildStrategyAssist(fixture());assert.equal(find(result,'identity.category').reasonCode,'missing');assert.equal(find(result,'identity.category').recommendation,'ask');assert.equal(find(result,'goals.northStar').recommendation,'ask');assert.equal(find(result,'goals.northStar').reasonCode,'low_confidence');
 const modified=structuredClone(payload);modified.fieldStatus={'identity.positioning':'unsupported'};const unsupported=find(buildStrategyAssist(fixture(modified)),'identity.positioning');assert.equal(unsupported.recommendation,'flag');assert.equal(unsupported.reasonCode,'unsupported');
});
test('conflicts, aspirations and unanswered client questions always override source-backed acceptance',()=>{
 const modified=structuredClone(payload);modified.conflicts=[{field_path:'identity.positioning'}];assert.equal(find(buildStrategyAssist(fixture(modified)),'identity.positioning').recommendation,'flag');
 modified.conflicts=[];modified.fieldStatus={'identity.positioning':'aspirational'};assert.equal(find(buildStrategyAssist(fixture(modified)),'identity.positioning').reasonCode,'aspiration');
 const f=fixture();f.claims.find(c=>c.field_path==='identity.positioning').open_questions=1;assert.equal(find(buildStrategyAssist(f),'identity.positioning').reasonCode,'waiting');
});
test('unlinked, competitor and aspiration sources never manufacture support or source IDs',()=>{
 const f=fixture();const position=f.claims.find(c=>c.field_path==='identity.positioning');position.evidence=[{label:'Undurable homepage',quote:'Helpful but no durable source',source_id:'invented'},{source_id:'deck',quote:'Market claim'}];f.sources=structuredClone(sources);f.sources[0].signals={evidence:'competitor'};
 let item=find(buildStrategyAssist(f),'identity.positioning');assert.equal(item.citations.length,0);assert.equal(item.reasonCode,'no_source');assert.equal(item.recommendation,'ask');
 f.sources[0].signals={purpose:'aspiration'};assert.equal(find(buildStrategyAssist(f),'identity.positioning').citations.length,0);
 f.sources[0].signals={};position.evidence=[{label:'Recorded but undurable',quote:'Recorded excerpt'}];item=find(buildStrategyAssist(f),'identity.positioning');assert.equal(item.citations.length,0);assert.equal(item.recommendation,'ask');
});
test('sources without excerpts do not justify acceptance; unsafe URLs are omitted',()=>{
 const f=fixture();const position=f.claims.find(c=>c.field_path==='identity.positioning');position.evidence=[{source_id:'deck'}];assert.equal(find(buildStrategyAssist(f),'identity.positioning').reasonCode,'no_source');
 position.evidence[0].quote='Real recorded quote';f.sources=[{...sources[0],src:'javascript:alert(1)',evidence_url:'file:///private/source.pdf'}];const citation=find(buildStrategyAssist(f),'identity.positioning').citations[0];assert.equal(citation.url,null);assert.equal(citation.asset_url,null);assert.equal(Object.hasOwn(citation,'raw_ref'),false);
});
test('hard summary covers difficult strategy decisions and changes, with localized en/es/ar questions',()=>{
 const f=fixture();f.previousBio={payload:{...payload,identity:{...payload.identity,positioning:'Previous positioning'}}};const result=buildStrategyAssist(f),position=find(result,'identity.positioning');assert.equal(position.changed,true);assert.equal(result.summary.counts.changed,1);assert.ok(result.summary.hardClaimIds.includes(find(result,'goals.northStar').claim_id));assert.ok(!result.summary.hardClaimIds.includes(position.claim_id));
 for(const claim of result.claims)for(const locale of ['en','es','ar']){assert.ok(claim.assessment[locale]);assert.ok(claim.question[locale]);}for(const locale of ['en','es','ar'])assert.ok(result.summary.text[locale]);assert.match(position.question.es,/alternativas/);assert.match(position.question.ar,/البدائل/);
});
test('projection is deterministic and read-only; no patches, persisted decisions or certification authority',()=>{
 const f=fixture(),before=structuredClone(f);const result=buildStrategyAssist(f);assert.deepEqual(f,before);assert.deepEqual(result,buildStrategyAssist(f));assert.ok(!Object.hasOwn(result,'decision'));for(const claim of result.claims){assert.ok(!Object.hasOwn(claim,'patch'));assert.ok(!Object.hasOwn(claim,'certified'));}
});
