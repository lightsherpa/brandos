// Append a fresh unreviewed candidate after a zero-provider CSS spot check.
// Never mutate or certify the original live result.
import {execFileSync} from 'node:child_process';import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';import {createClient} from '@supabase/supabase-js';
import {scoreBio} from '../server/src/lib/score-bio.js';
const status=JSON.parse(execFileSync('supabase',['status','--workdir','.bio-local','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));assert.equal(status.API_URL,'http://127.0.0.1:57421');
const sb=createClient(status.API_URL,status.SERVICE_ROLE_KEY);
const original=JSON.parse(await readFile('output/bio-discovery/cake-me-live.json','utf8')),styles=JSON.parse(await readFile('output/bio-discovery/cake-me-visual-spot-check.json','utf8'));
const payload=structuredClone(original.bio.payload);payload.visual={...payload.visual,palette:styles.palette,type:styles.type,contrastPairs:styles.contrastPairs};
payload.visualEvidence.sources[0]={...payload.visualEvidence.sources[0],styles,visual:{...payload.visualEvidence.sources[0].visual,...payload.visual}};
payload.visualRefresh={method:'zero-provider-linked-css-follow-up',previousVersion:original.bio.version,checkedAt:new Date().toISOString(),manualTypography:styles.manualComputedTypography,limitations:['CSS declarations do not prove actual usage. Heading and navigation fonts were checked in the browser; other faces remain declared-only.','Roles remain inferred. Contrast ratios are mathematical pairs, not proof of accessible text placement.']};
for(const field of ['palette','type'])payload.confidence['visual.'+field]={conf:80,source:'Linked website CSS · '+styles.stylesheets.join(' · ')};
const {data,error}=await sb.rpc('append_bio_version',{p_brand_id:original.brandId,p_payload:payload,p_score:scoreBio(payload),p_created_by:null,p_discovery_id:null});if(error)throw error;
await writeFile('output/bio-discovery/cake-me-refined.json',JSON.stringify({originalVersion:original.bio.version,bio:data,paidCostUsd:0},null,2));
const publicPayload=structuredClone(payload);for(const source of publicPayload.visualEvidence.sources)delete source.screenshotUrl;
await writeFile('public/demo/bio/cake-me.json',JSON.stringify({brandName:'Cake-me · live test with visual follow-up',bio:{id:'cake-me-refined-candidate',version:data.version,payload:publicPayload,certified:false,self_certified:false}},null,2)+'\n');
console.log(`Saved unreviewed visual follow-up v${data.version}; original live BIO retained.`);
