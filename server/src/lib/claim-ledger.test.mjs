import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClaimLedger, certifierS1Enabled, safeEvidenceUrl } from './claim-ledger.js';
import { claimId } from './claim-id.js';
import { normalizeBio } from './bio-schema.js';
import { assertHumanActor } from './human-actor.js';
import { claimState, reviewGate, confirmSection, reviewPatch, validateClaimReview } from './claim-review.js';
const payload = () => normalizeBio({
  visual:{logo:{sourceId:'logo',conf:100},palette:[{role:'primary',hex:'#ffd115'}],type:[{kind:'Display',family:'Instrument Sans',provider:'google'}]},
  identity:{positioning:'Made for joy'},confidence:{'identity.positioning':{conf:90,source:'https://brand.test/about'}},
  evidence:{'identity.positioning':'Made for joy, everyday.'},
});
const sources = [{id:'logo',kind:'file_upload',src:'mark.png',signals:{mime:'image/png',rights_confirmed:true},evidence_url:'https://files.test/signed.png'},
  {id:'site',kind:'url_scrape',src:'https://brand.test/about',signals:{snippet:'Made for joy, everyday.',screenshotUrl:'https://files.test/screenshot.png'}}];
const ledger = (p=payload(), messages=[]) => buildClaimLedger({brandId:'brand',bioVersion:2,payload:p,sources,messages,brandUrl:'https://brand.test'});
const resolved = l => Object.fromEntries(l.claims.map(c => [c.claim_id,{state:'confirmed',evidence_token:c.evidence_token}]));

test('S1 flag defaults off and reads runtime changes', () => {
  delete process.env.CERTIFIER_V2_S1;assert.equal(certifierS1Enabled(),false);
  process.env.CERTIFIER_V2_S1='true';assert.equal(certifierS1Enabled(),true);process.env.CERTIFIER_V2_S1='1';assert.equal(certifierS1Enabled(),true);delete process.env.CERTIFIER_V2_S1;
});
test('claim IDs exactly match S3, are stable, and separate brands and BIO versions', () => {
  const c = ledger().claims.find(c => c.field_path === 'identity.positioning');
  assert.equal(c.claim_id,claimId('brand',2,'identity.positioning'));
  assert.equal(c.claim_id,ledger().claims.find(x => x.field_path === c.field_path).claim_id);
  assert.notEqual(c.claim_id,claimId('brand',3,c.field_path));assert.notEqual(c.claim_id,claimId('other',2,c.field_path));
});
test('risk queue puts missing foundation claims first and high claims last in section', () => {
  const l = ledger();const foundation=l.claims.filter(c => c.section==='foundation');
  assert.equal(foundation[0].level,'to_confirm');assert.equal(foundation.at(-1).level,'high');
  const broken=payload();delete broken.visual.logo;delete broken.visual.type;broken.visual.palette=[];
  const missing=ledger(broken).claims.slice(0,3).map(c => c.field_path);
  assert.deepEqual(new Set(missing),new Set(['visual.logo','visual.type','visual.palette']));
});
test('evidence matches only the claim source and carries snippet, URL and screenshot', () => {
  const c=ledger().claims.find(c => c.field_path==='identity.positioning');
  assert.equal(c.level,'high');assert.equal(c.evidence[0].quote,'Made for joy, everyday.');
  assert.equal(c.evidence[0].url,'https://brand.test/about');assert.equal(c.evidence[0].screenshot,'https://files.test/screenshot.png');
  assert.equal(c.evidence.length,1);
  const absent=ledger().claims.find(c => c.field_path==='audience.primary');assert.equal(absent.level,'to_confirm');assert.deepEqual(absent.evidence,[]);
});
test('framework primary, inferred sources and palette/font conflicts stay risky', () => {
  const p=payload();p.visual.palette=[{role:'primary',hex:'#000000'}];p.confidence['visual.palette']={conf:99,source:'https://brand.test/about'};
  assert.equal(ledger(p).claims.find(c => c.field_path==='visual.palette').level,'guessed');
  p.visual.palette=[{role:'primary',hex:'#123456',source:'site'},{role:'primary',hex:'#ffd115',source:'brand pdf'}];
  assert.equal(ledger(p).claims.find(c => c.field_path==='visual.palette').level,'conflicting');
  p.confidence['identity.positioning']={conf:99,source:'LLM inferred https://brand.test/about'};
  assert.equal(ledger(p).claims.find(c => c.field_path==='identity.positioning').level,'guessed');
});
test('competitor and aspiration sources never count as brand evidence, unsafe links never render', () => {
  const l=buildClaimLedger({brandId:'brand',bioVersion:2,payload:payload(),sources:sources.map(s => ({...s,signals:{...s.signals,counts_as_brand_evidence:false,purpose:'competitive'}}))});
  assert.ok(l.claims.every(c => c.evidence.every(e => !e.source_id)));
  assert.equal(safeEvidenceUrl('javascript:alert(1)'),null);assert.equal(safeEvidenceUrl('data:text/html,bad'),null);
});
test('signed URL refreshes preserve evidence tokens', () => {
  const a=ledger();const b=buildClaimLedger({brandId:'brand',bioVersion:2,payload:payload(),sources:sources.map(s => ({...s,evidence_url:'https://files.test/new-token'})),brandUrl:'https://brand.test'});
  assert.deepEqual(a.claims.map(c=>c.evidence_token),b.claims.map(c=>c.evidence_token));
});
test('seal requires every claim and the real foundation gate, including display font and logo rights', () => {
  const l=ledger(),decisions=resolved(l);const options={claims:l.claims,decisions,payload:payload(),logoRights:['logo']};
  assert.equal(reviewGate(options).ready,true);
  assert.equal(reviewGate({...options,decisions:{}}).ready,false);
  assert.equal(reviewGate({...options,logoRights:[]}).ready,false);
  const p=payload();p.visual.type=[{kind:'Body',family:'Instrument Sans',provider:'google'}];
  assert.equal(reviewGate({...options,payload:p}).ready,false);
  p.visual.palette=[];assert.equal(reviewGate({...options,payload:p}).ready,false);
});
test('Ask and Skip do not resolve claims; new evidence requires an explicit human decision', () => {
  const l=ledger();const c=l.claims[0];
  assert.equal(claimState(c,null),'to_confirm');assert.equal(claimState(c,{state:'asked'}),'asked');
  const q={id:'q',claim_ids:[c.claim_id],bio_version:2,author_role:'cd',sent_at:'now'};
  assert.equal(claimState(c,{state:'confirmed',evidence_token:c.evidence_token},[q]),'asked');
  const answer={id:'a',reply_to:'q',claim_ids:[c.claim_id],bio_version:2,author_role:'client',sent_at:'now'};
  assert.equal(claimState(c,{state:'confirmed',evidence_token:'old'},[q,answer]),'new_evidence');
  assert.equal(claimState(c,{state:'confirmed',evidence_token:c.evidence_token},[q,answer]),'confirmed');
});
test('answers stay attached to their exact stable claim/version and invalidate its decision token', () => {
  const a=ledger();const c=a.claims.find(c=>c.field_path==='visual.logo');
  const answer={id:'answer',claim_ids:[c.claim_id],bio_version:2,author_role:'client',body:'Use a new logo',sent_at:'now'};
  const b=ledger(payload(),[answer]);assert.notEqual(b.claims.find(x=>x.claim_id===c.claim_id).evidence_token,c.evidence_token);
  assert.deepEqual(a.claims.map(c=>c.evidence_token),ledger(payload(),[{...answer,bio_version:1}]).claims.map(c=>c.evidence_token));
});
test('bulk confirmation includes only medium/high and preserves Asked and Fixed', () => {
  const claims=['to_confirm','conflicting','guessed','low','medium','high'].map((level,i)=>({claim_id:`c${i}`,section:'foundation',level,evidence_token:'t'}));
  assert.deepEqual(Object.keys(confirmSection(claims,{},'foundation')),['c4','c5']);
  const prior={c4:{state:'asked'},c5:{state:'fixed',value:'new'}};
  assert.deepEqual(confirmSection(claims,prior,'foundation'),prior);
});
test('fixed values build a minimal nested patch without erasing siblings', () => {
  const l=ledger();const c=l.claims.find(c=>c.field_path==='visual.palette');
  const patch=reviewPatch(l.claims,{[c.claim_id]:{state:'fixed',value:[{role:'primary',hex:'#ffaa00'}]}});
  assert.deepEqual(patch,{visual:{palette:[{role:'primary',hex:'#ffaa00'}]}});
});
test('API validation rejects unresolved, stale, invented claims and unreviewed patches', () => {
  const l=ledger();const review={bio_version:2,decisions:resolved(l)};
  assert.equal(validateClaimReview(l,review,payload(),['logo']),null);
  assert.equal(validateClaimReview(l,{...review,bio_version:1},payload(),['logo']).code,'STALE_CLAIM_REVIEW');
  assert.equal(validateClaimReview(l,{...review,decisions:{}},payload(),['logo']).code,'CLAIMS_UNRESOLVED');
  assert.equal(validateClaimReview(l,{...review,decisions:{...review.decisions,bogus:{state:'confirmed'}}},payload(),['logo']).code,'CLAIM_REVIEW_INVALID');
  const p=payload();p.identity.positioning='Unreviewed';assert.equal(validateClaimReview(l,review,p,['logo']).code,'CLAIM_REVIEW_INVALID');
  const changed={...l,claims:l.claims.map((c,i)=>i===0?{...c,evidence_token:'changed'}:c)};
  assert.equal(validateClaimReview(changed,review,payload(),['logo']).code,'STALE_CLAIM_REVIEW');
});
test('assertHumanActor accepts verified users and rejects agent or service actors', () => {
  assert.doesNotThrow(()=>assertHumanActor({userId:'human'}));
  for(const auth of [null,{userId:'agent',actor:{type:'agent'}},{userId:'agent',actor_type:'agent'},{userId:'service',role:'service_role'}]) assert.throws(()=>assertHumanActor(auth),e=>e.code==='AGENT_CANNOT_CERTIFY');
});

test('database source ordering does not make an unchanged review stale', () => {
  const p=payload();p.visual.logo.variants={dark:{sourceId:'variant'}};
  const all=[...sources,{id:'variant',kind:'file_upload',src:'dark.png',signals:{mime:'image/png'}}];
  const make=s=>buildClaimLedger({brandId:'brand',bioVersion:2,payload:p,sources:s,brandUrl:'https://brand.test'});
  assert.deepEqual(make(all).claims.map(c=>c.evidence_token),make(all.toReversed()).claims.map(c=>c.evidence_token));
});

test('an upload without a confidence value cannot acquire infinite/high confidence', () => {
  const p=payload();delete p.visual.logo.conf;
  assert.equal(ledger(p).claims.find(c=>c.field_path==='visual.logo').level,'medium');
});

test('high-confidence claims still use computeFocus importance for risk tie-breaking', () => {
  const p=payload();p.identity.category='Bakery';p.confidence['identity.category']={conf:95,source:'https://brand.test/about'};
  p.confidence['identity.positioning'].conf=95;
  const high=ledger(p).claims.filter(c=>c.section==='strategy'&&c.level==='high');
  assert.ok(high.findIndex(c=>c.field_path==='identity.positioning') < high.findIndex(c=>c.field_path==='identity.category'));
});
