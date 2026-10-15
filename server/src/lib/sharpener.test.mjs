// server/src/lib/sharpener.test.mjs
// CAA-26 (P2): the Sharpener's cite-BIO contract was prompt-only. questionCitesBio
// is the cheap server-side gate — it must pass questions that reference a real BIO
// field and reject generic ones, while failing open when no BIO is available.
import { test } from "node:test";
import assert from "node:assert/strict";
import { questionCitesBio } from "./sharpener.js";

const BIO = {
  version: 1,
  identity: { positioning: "Specialty coffee for people who take mornings seriously", category: "Coffee", pillars: ["ritual", "craft"] },
  audience: { primary: "home baristas", jtbd: ["a better pour-over"] },
  voice: { register: "warm, editorial", forbidden: ["cheap", "hack"], signatures: ["the slow pour"] },
  goals: { northStar: "own the morning ritual" },
  strategic: { watchouts: ["never sound like a chain"], notList: ["not a convenience brand"] },
};

test("rejects a generic why that cites no BIO field", () => {
  assert.equal(questionCitesBio({ q: "what's the budget?", why: "because clarity matters" }, BIO), false);
});

test("accepts a why naming a structural BIO section (voice register)", () => {
  assert.equal(questionCitesBio({ q: "how playful?", why: "ties to the voice register, which is warm and editorial" }, BIO), true);
});

test("accepts a why that shares a meaningful token with the BIO (no section keyword)", () => {
  // "mornings"/"seriously" appear in the positioning; the why names neither a section.
  assert.equal(questionCitesBio({ q: "which ritual?", why: "connects to how seriously mornings are treated" }, BIO), true);
});

test("rejects an empty, missing, or too-short why", () => {
  assert.equal(questionCitesBio({ q: "x", why: "" }, BIO), false);
  assert.equal(questionCitesBio({ q: "x" }, BIO), false);
  assert.equal(questionCitesBio({ q: "x", why: "a bio" }, BIO), false);
});

test("fails open when there is no BIO to check against", () => {
  assert.equal(questionCitesBio({ q: "x", why: "any sufficiently long rationale here" }, null), true);
  assert.equal(questionCitesBio({ q: "x", why: "any sufficiently long rationale here" }, {}), true);
});

test("a forbidden-word reference counts as a citation", () => {
  assert.equal(questionCitesBio({ q: "tone check", why: "the forbidden words list rules out that angle" }, BIO), true);
});

import {sharpenBrief,sharpenerFastEnabled,fastModelConfidence,renderedBrandCoreContext,fastSharpenerQuality} from './sharpener.js';
const confidentBio=()=>({...BIO,confidence:{'identity.positioning':{conf:95},'audience.primary':{conf:90},'voice.register':{conf:100}}});
const validOutput=()=>({title:'Mornings worth slowing down for',tension:'Coffee ritual deserves more than another quick caffeine hit.',sharpenedBrief:'Make five warm, editorial Instagram posts for home baristas who value the morning ritual. Show the craft of a better pour-over, with a clear invitation to make time for it.',questions:[{q:'Should the first post show the pour or the finished cup?',solvingFor:'Choose whether craft or the finished ritual leads the story.',why:'The Brand Core positioning values mornings seriously and its pillars are ritual and craft.'},{q:'Should each post invite a slower morning or show one brewing technique?',solvingFor:'Choose whether to lead with the emotional ritual or practical craft.',why:'The primary audience is home baristas and the job is a better pour-over.'}],deliveryPlan:{deliverableGroups:[{type:'social_post',count:5,platforms:['instagram'],parts:['caption','image'],crew:{caption:'a16',image:'a41'}}]},refusals:['Avoid cheap or hack language.']});
function completionFixture(outputs){const calls=[];return {calls,completion:async function*(args){calls.push(args);const value=outputs.shift();if(value instanceof Error){yield{type:'error',message:value.message};return;}yield{type:'token',text:typeof value==='string'?value:JSON.stringify(value)};yield{type:'done',usage:{input_tokens:200,output_tokens:200}};}};}
test('fast sharpener defaults off and requires complete high-confidence core fields',()=>{
 const original=process.env.SHARPENER_FAST;delete process.env.SHARPENER_FAST;try{assert.equal(sharpenerFastEnabled(),false);assert.equal(fastModelConfidence(BIO),false);assert.equal(fastModelConfidence(confidentBio()),true);assert.equal(fastModelConfidence({...confidentBio(),conflicts:[{field:'voice.register'}]}),false);}finally{if(original===undefined)delete process.env.SHARPENER_FAST;else process.env.SHARPENER_FAST=original;}
});
test('fast path makes one bounded Haiku call and preserves usable grounded questions and visual crew',async()=>{
 const f=completionFixture([validOutput()]);const result=await sharpenBrief({briefText:'Five Instagram posts for a new coffee',brand:{id:'fast-brand',name:'Morning'},bio:confidentBio(),completion:f.completion,fast:true});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].maxTokens,1600);assert.equal(f.calls[0].spec.payload.modelRouting.primary,'anthropic/claude-haiku-4-5-20251001');assert.equal(result.questions.length,2);assert.deepEqual(result.deliveryPlan.deliverableGroups[0].crew,{caption:'a16',image:'a41'});assert.equal(result.performance.attempts,1);assert.ok(f.calls[0].system.length<6500);assert.match(f.calls[0].messages[0].content,/warm, editorial/);
});
test('low-confidence context goes directly to Sonnet without a speculative fast call',async()=>{
 const f=completionFixture([validOutput()]);await sharpenBrief({briefText:'Five coffee posts',brand:{name:'Morning'},bio:BIO,completion:f.completion,fast:true});assert.equal(f.calls.length,1);assert.equal(f.calls[0].spec.payload.modelRouting.primary,'anthropic/claude-sonnet-4-6');
});
test('invalid fast JSON gets exactly one Sonnet quality fallback',async()=>{
 const f=completionFixture(['bad json',validOutput()]);const result=await sharpenBrief({briefText:'Five coffee posts',brand:{name:'Morning'},bio:confidentBio(),completion:f.completion,fast:true});assert.equal(f.calls.length,2);assert.equal(result.performance.model,'anthropic/claude-sonnet-4-6');assert.equal(result.performance.attempts,2);assert.match(f.calls[1].messages[0].content,/quality validation/);
});
test('generic questions, empty crew, wrong specialists and ungrounded briefs fail closed after one fallback',async()=>{
 const invalids=[value=>value.questions.forEach(q=>q.why='The voice register needs clarity.'),value=>value.deliveryPlan.deliverableGroups[0].crew.image='a01',value=>value.deliveryPlan.deliverableGroups=[],value=>value.sharpenedBrief='Create professional content for the target audience. Increase engagement with clear creative and a call to action.',value=>value.questions.splice(1),value=>value.deliveryPlan.deliverableGroups[0].platforms=['invented']];
 for(const mutate of invalids){const invalid=validOutput();mutate(invalid);assert.equal(fastSharpenerQuality(invalid,BIO),false);const f=completionFixture([invalid,invalid]);await assert.rejects(sharpenBrief({briefText:'Five coffee posts',bio:confidentBio(),completion:f.completion,fast:true}),/needs another attempt/);assert.equal(f.calls.length,2);}
});
test('rendered Brand Core cache is keyed by exact brand/payload/refusals and bounded by LRU',()=>{
 const brand={id:'cache-test',name:'Morning'};assert.equal(renderedBrandCoreContext(brand,BIO,['a']).cacheHit,false);assert.equal(renderedBrandCoreContext(brand,BIO,['a']).cacheHit,true);assert.equal(renderedBrandCoreContext(brand,{...BIO,voice:{...BIO.voice,register:'bold'}},['a']).cacheHit,false);assert.equal(renderedBrandCoreContext({...brand,id:'other'},BIO,['a']).cacheHit,false);assert.equal(renderedBrandCoreContext(brand,BIO,['b']).cacheHit,false);
 for(let n=0;n<33;n++)renderedBrandCoreContext({id:`lru-${n}`},BIO,[]);assert.equal(renderedBrandCoreContext(brand,BIO,['a']).cacheHit,false);
});
test('disabled fast flag keeps the existing primary model and token budget',async()=>{
 const f=completionFixture([validOutput()]);await sharpenBrief({briefText:'Five coffee posts',bio:BIO,completion:f.completion,fast:false});assert.equal(f.calls[0].spec.payload.modelRouting.primary,'anthropic/claude-sonnet-5-5');assert.equal(f.calls[0].maxTokens,3200);
});
test('email hero requirements keep canonical email crew and produce actionable private failure codes',async()=>{
 const valid=validOutput();valid.deliveryPlan.deliverableGroups=[{type:'email_sequence',count:1,platforms:['email'],parts:['subject','body'],crew:{subject:'a14',body:'a13'}}];
 const invalid=structuredClone(valid);invalid.deliveryPlan.deliverableGroups[0].crew.hero_image='a21';invalid.deliveryPlan.deliverableGroups[0].parts.push('hero_image');
 const f=completionFixture([invalid,valid]);const result=await sharpenBrief({briefText:'One HTML email with photographic hero',bio:confidentBio(),completion:f.completion,fast:true});
 assert.equal(result.deliveryPlan.deliverableGroups[0].type,'email_sequence');assert.match(f.calls[0].system,/DO NOT add html, preheader, headline, cta or hero_image/);assert.match(f.calls[1].messages[0].content,/deliveryPlan\.0\.crew/);
});
