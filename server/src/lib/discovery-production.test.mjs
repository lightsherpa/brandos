import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {SCORED_PATHS} from './bio-schema.js';
const root=new URL('../',import.meta.url);
const previousV2=process.env.DISCOVERY_V2;process.env.DISCOVERY_V2='1';
let run,rights,gate,savedPayload;
const payload={confidence:{},positioning:{researchGaps:[]}};
for(const [section,key] of SCORED_PATHS){payload[section]??={};payload[section][key]='recorded';payload.confidence[`${section}.${key}`]={conf:100,source:`source-${section}-${key}`};}
payload.visual={logo:{sourceId:'logo',conf:100},palette:[{role:'primary',hex:'#4ba5aa'}],type:[{kind:'Display',family:'Inter',provider:'google'}]};
const db={from(table){const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},insert(){return q;},update(){return q;},upsert(value){if(table==='discovery_runs')run=value;return q;},
 async maybeSingle(){return {data:table==='brands'?{id:'brand',name:'Brand',url:'https://brand.es',workspace_id:'ws',refusals:[]}:null,error:null};},
 then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);}};return q;},
 async rpc(name,args){
  if(name==='append_bio_version'){savedPayload=args.p_payload;return {data:{id:'bio',version:1},error:null};}
  assert.equal(name,'reconcile_bio_review');
  gate={status:args.p_report.meetsFloor?'queued':'gated',job_id:args.p_report.meetsFloor?'job':null,created:false};
  if(run.bio_id===args.p_bio_id)run={...run,status:gate.status==='gated'?'gated':'completed',stage:gate.status==='gated'?'review_gate':'done'};
  return {data:gate,error:null};
 }
};
mock.module(new URL('lib/supabase.js',root).href,{namedExports:{supabaseAdmin:db}});
mock.module(new URL('lib/inngest.js',root).href,{namedExports:{inngest:{createFunction:(_options,handler)=>handler}}});
mock.module(new URL('lib/firecrawl.js',root).href,{namedExports:{isReadableSource:()=>true,scrape:async()=>({markdown:'Local brand evidence',rawHtml:'<html lang="es"></html>'}),mapAndScrape:async()=>[],searchCompetitiveSources:async()=>[]}});
mock.module(new URL('lib/discovery-intelligence.js',root).href,{namedExports:{generateDiscoveryBrain:async()=>structuredClone(payload),sourceBlock:()=>'',normalizeDiscoveryReferences:()=>[]}});
const observed={logo:{url:'https://brand.es/logo.png',conf:90},palette:[{hex:'#6fd4e4',role:'primary',evidence:['header link CSS']}],type:[{kind:'Display',family:'DinC',usageStatus:'declared-not-computed'}],imagery:[],avoid:[]};
mock.module(new URL('lib/discovery-visuals.js',root).href,{namedExports:{collectDiscoveryVisuals:async()=>({sources:[{url:'https://brand.es',purpose:'current',visual:observed}],limitations:[]})}});
mock.module(new URL('lib/visual-assets.js',root).href,{namedExports:{loadVisualAssets:async()=>({logos:[],fonts:[],references:[]}),mergeTypographyFromAssets:type=>type}});
mock.module(new URL('lib/foundation-assets.js',root).href,{namedExports:{loadLogoRights:async()=>rights}});
mock.module(new URL('lib/validate-discovery-candidate.js',root).href,{namedExports:{validateDiscoveryCandidate:()=>{}}});
mock.module(new URL('lib/assign-steward.js',root).href,{namedExports:{assignSteward:async()=>{}}});
const {compileBio}=await import('../inngest/functions/compile-bio.js');
if(previousV2===undefined)delete process.env.DISCOVERY_V2;else process.env.DISCOVERY_V2=previousV2;

test('production V2 persists deterministic logo/palette instead of stale model visual and keeps rights/font gate closed',async()=>{
 rights=[];run=null;gate=null;
 const step={async run(_name,fn){return fn();}};
 const result=await compileBio({event:{data:{brandId:'brand',workspaceId:'ws',url:'https://brand.es',discoveryId:'discovery'}},step,logger:{info(){},warn(){}}});
 assert.equal(savedPayload.visual.logo.url,'https://brand.es/logo.png');
 assert.equal(savedPayload.visual.palette[0].hex,'#6fd4e4');
 assert.equal(savedPayload.visual.type[0].family,'DinC');
 assert.equal(run.status,'gated');assert.equal(result.stewardJobId,null);
});
