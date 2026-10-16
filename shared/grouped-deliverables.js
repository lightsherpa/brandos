// Presentation only: combine existing runs into customer deliverables. No roster,
// prompt, or persistence changes. The production taxonomy remains authoritative.
import { DELIVERABLE_TYPES } from '../server/src/lib/taxonomy.js';
const canonical = type => ({email_sequence:'email',newsletter:'email',key_visual:'hero_kv',landing_section:'landing_page'}[type] || type);
export {canonical as canonicalDeliveryType};
const EXTRA = {deck:{...DELIVERABLE_TYPES.deck,crew:{...DELIVERABLE_TYPES.deck.crew,build:'a27'}},email:{...DELIVERABLE_TYPES.email,crew:{...DELIVERABLE_TYPES.email.crew,html:'a26',design:'a48'}},landing_page:{crew:{heading:'a37',body:'a12',build:'a25'}}};
const QA = new Set(['a18','a24']);
const decode = value => {if(typeof value!=='string')return value||{};try{return JSON.parse(value);}catch{return {text:value};}};
export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeAsset = value => {
 if(/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value||''))return value;
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
};
const registry = Object.fromEntries(Object.entries({...DELIVERABLE_TYPES,...EXTRA}).filter(([key])=>key!=='legacy').map(([key,spec])=>[key,{...spec,type:canonical(key)}]));
const preferred = ['social_post','email','hero_kv','landing_page','deck'];
export function deliveryTypeForAgent(id) {
 for(const type of preferred) {const spec=registry[type]||registry[type==='landing_page'?'landing_section':type];if(Object.values(spec?.crew||{}).includes(id))return type;}
 return Object.values(registry).find(spec=>Object.values(spec.crew).includes(id))?.type || null;
}
export function combinedDeliveryStatus({runs=[],parts=[],complete=false,finished=false}={}) {
 if(runs.some(r=>['failed','error','flagged','rejected'].includes(r.status))||parts.some(p=>['failed','error','flagged','rejected','changes_requested_internal','changes_requested_client'].includes(p.status)||p.qa?.passed===false||p.quarantined))return 'attention';
 if(runs.some(r=>['running','queued','writing','imaging','checking','fixing'].includes(r.status)))return 'working';
 if(!complete)return finished?'attention':'working';
 if(parts.length&&parts.every(p=>p.approved))return 'delivered';
 return 'review';
}
function partsFor(run) {
 return (run.outputs||[]).flatMap(output=>{
  const body=decode(output.body), snapshot=body.snapshot||body;
  const type=canonical(body.type||snapshot.type||deliveryTypeForAgent(run.specialist_id));
  const part=body.part||Object.entries(registry[type]?.crew||{}).find(([,id])=>id===run.specialist_id)?.[0];
  const approved=output.workflow_status==='client_approved'&&!!output.client_reviewed_by&&!!output.client_reviewed_at;
  const items=body.deliverables||snapshot.items||(body.item?[body.item]:[body]);
  return items.map((item,index)=>{
   const checks=[...(item.checks||[]),...(item.review||[])];
   const caption=item.copy?.caption;
   const text=item.edited_text||item.body||item.text||(caption?[caption,(item.copy.hashtags||[]).join(' ')].filter(Boolean).join('\n'):item.copy?.body)||'';
   return {
    outputId:output.id,runId:run.id,agentId:run.specialist_id,index:item.index??index,type,part,
    platform:item.platform||body.platform,
    status:['changes_requested_internal','changes_requested_client'].includes(output.workflow_status)?output.workflow_status:item.status||output.status,
    workflow:output.workflow_status,approved,
    qa:item.qa||(checks.length?{passed:!checks.some(check=>check.pass===false)}:null),
    quarantined:item.quality_gated===true&&!['ready','approved'].includes(item.status),
    text,subject:item.copy?.subject||'',
    html:item.html||(['html','build'].includes(part)&&/^\s*(?:<!doctype html|<html|<table)/i.test(text)?text:''),
    assetUrl:safeAsset(item.asset_url||item.assetUrl||item.image_url||item.image?.asset_url||output.asset_url),
    title:item.title||'',
   };
  });
 });
}
export function groupDeliverables({runs=[],plan,expectedSpecialists=[],creditsByAgent={},finished=false,internal=false}={}) {
 const newest=[...runs].sort((a,b)=>String(b.ended_at||b.started_at||b.created_at||'').localeCompare(String(a.ended_at||a.started_at||a.created_at||''))||String(b.id||'').localeCompare(String(a.id||'')));
 const allParts=newest.flatMap(partsFor), types=new Set();
 const planned=(plan?.deliverableGroups||[]).filter(g=>g.type==='legacy'||registry[canonical(g.type)]||EXTRA[canonical(g.type)]);
 if(Array.isArray(plan?.deliverableGroups)&&plan.deliverableGroups.length){
  // A saved plan is authoritative: incidental or old runs cannot grow cards.
  for(const group of planned)types.add(canonical(group.type));
 }else{
  for(const part of allParts)if(registry[part.type]||EXTRA[part.type])types.add(part.type);
  const infer=id=>{
   const type=QA.has(id)?null:deliveryTypeForAgent(id);
   if(type&&![...types].some(t=>Object.values(registry[t]?.crew||{}).includes(id)))types.add(type);
  };
  // Explicit output types win over an agent's usual role (Granada used a12
  // for an email body). Unknown declared types are not reassigned by guessing.
  for(const run of newest)if(!allParts.some(part=>part.runId===run.id))infer(run.specialist_id);
  for(const id of expectedSpecialists)if(!allParts.some(part=>part.agentId===id))infer(id);
  if(!types.size&&runs.length)types.add('legacy');
 }
 return [...types].sort((a,b)=>(preferred.indexOf(a)<0?99:preferred.indexOf(a))-(preferred.indexOf(b)<0?99:preferred.indexOf(b))).flatMap(type=>{
  const plans=(plan?.deliverableGroups||[]).filter(g=>canonical(g.type)===type);
  const spec=registry[type]||registry[type==='landing_page'?'landing_section':type]||{crew:{}};
  const ids=new Set([...Object.values(spec.crew),...plans.flatMap(g=>Object.values(g.crew||{}))]);
  const belongs=run=>{
   const typed=allParts.filter(p=>p.runId===run.id&&p.type);
   if(typed.length)return typed.some(p=>p.type===type);
   return ids.has(run.specialist_id)||(type==='legacy'&&!deliveryTypeForAgent(run.specialist_id));
  };
  const relevant=newest.filter(r=>belongs(r)||(QA.has(r.specialist_id)&&!allParts.some(p=>p.runId===r.id&&p.type)));
  const parts=allParts.filter(p=>relevant.some(r=>r.id===p.runId)&&(p.type===type||(!p.type&&(QA.has(p.agentId)||type==='legacy'))));
  const platforms=[...new Set(plans.flatMap(g=>g.platforms||[]).concat(parts.map(p=>p.platform).filter(Boolean)))];
  const count=Math.max(1,...plans.map(g=>Number(g.count)||1),...parts.map(p=>p.index+1));
  // Credits are an aggregate only. Retries remain charged; distributing the
  // group total across items preserves the exact brief total without rounding.
  const creditRuns=newest.filter(r=>belongs(r));
  const total=creditRuns.reduce((sum,r)=>sum+(Number.isFinite(r.credits)?r.credits:0),0);
  const estimatedIds=new Set([...creditRuns.map(r=>r.specialist_id),...expectedSpecialists.filter(id=>ids.has(id)),...plans.flatMap(g=>Object.values(g.crew||{}))]);
  const estimate=[...estimatedIds].reduce((sum,id)=>sum+(Number(creditsByAgent[id])||0),0);
  const qaCredits=newest.filter(r=>QA.has(r.specialist_id)&&!allParts.some(p=>p.runId===r.id&&p.type)).reduce((sum,r)=>sum+(Number(r.credits)||0),0);
  const orderedTypes=[...types];const share=Math.floor(qaCredits/orderedTypes.length)+(orderedTypes.indexOf(type)<qaCredits%orderedTypes.length?1:0);
  const baseCredits=creditRuns.some(r=>Number.isFinite(r.credits))?total:estimate;
  const groupCredits=baseCredits+share;
  return Array.from({length:Math.min(20,count)},(_,index)=>{
   const slot=parts.filter(p=>p.index===index),last=new Map();
   for(const p of slot){const key=p.part||p.agentId;if(!last.has(key))last.set(key,p);}
   const current=[...last.values()],usable=current.filter(p=>!p.quarantined),activeRuns=[...new Map(relevant.map(r=>[r.specialist_id,r]).reverse()).values()];
   const body=usable.find(p=>['body','caption','slides','output'].includes(p.part))||usable.find(p=>p.text&&!['subject','image'].includes(p.part))||(type==='email'?null:usable.find(p=>p.text));
   const subject=usable.find(p=>p.part==='subject')?.text||body?.subject||'';
   const image=usable.find(p=>p.assetUrl)?.assetUrl||null;
   const composite=usable.find(p=>p.html&&!p.quarantined)?.html||'';
   const text=typeof body?.text==='string'?body.text:'';
   const requiredImage=['social_post','carousel','hero_kv','ad_creative','deck','mood_frame'].includes(type);
   const complete=!!(composite||(type==='hero_kv'||type==='mood_frame'?image:text&&(!requiredImage||image)))&&(!['email'].includes(type)||!!subject||!!body?.subject)&&!current.some(p=>p.quarantined);
   const requiredIds=new Set(plans.flatMap(g=>Object.values(g.crew||{})));
   const assignedComplete=[...requiredIds].every(id=>relevant.some(r=>r.specialist_id===id&&!['failed','queued','running'].includes(r.status)));
   const checksComplete=current.length>0&&current.every(p=>p.approved||p.qa?.passed===true||['qa_passed','ready','approved'].includes(p.status));
   const assignedIds=new Set([...requiredIds,...expectedSpecialists,...activeRuns.map(r=>r.specialist_id)]);
   const builder={email:'a26',landing_page:'a25',deck:'a27'}[type];
   const isComplete=complete&&assignedComplete&&checksComplete&&(!builder||!assignedIds.has(builder)||!!composite);
   const status=combinedDeliveryStatus({runs:activeRuns,parts:current,complete:isComplete,finished});
   const safe={text,subject,html:composite,assetUrl:image};
   return {id:`${type}-${index+1}`,type,index,platform:platforms[0]||null,status,credits:Math.floor(groupCredits/count)+(index<groupCredits%count?1:0),complete:isComplete,...safe,
    ...(internal?{production:current.map(p=>({agentId:p.agentId,outputId:p.outputId,status:p.status,part:p.part})),outputIds:[...new Set(current.map(p=>p.outputId).filter(Boolean))]}:{})};
  });
 });
}
export function deliveryDocument(piece,{title='Brandolph',lang='en'}={}) {
 const image=piece.assetUrl?`<img src="${escapeHTML(safeAsset(piece.assetUrl)||'')}" alt="" style="max-width:100%;height:auto">`:'';
 let text=escapeHTML(piece.text).split(/\n\s*\n/).map(p=>`<p style="white-space:pre-wrap">${p}</p>`).join('');
 if(piece.type==='email'&&/^HEADLINE\n/m.test(piece.text||'')){
  const sections={};let current='BODY';
  for(const line of piece.text.split('\n')){if(['HEADLINE','BODY','BULLETS','CTA LABEL','FOOTER NOTE'].includes(line.trim())){current=line.trim();continue;}(sections[current]||=[]).push(line);}
  const section=key=>escapeHTML((sections[key]||[]).join('\n').trim());
  text=`<h2 style="font-size:28px;line-height:1.2">${section('HEADLINE')}</h2>${section('BODY').split(/\n\s*\n/).map(p=>`<p>${p}</p>`).join('')}${sections.BULLETS?`<ul>${sections.BULLETS.filter(line=>line.trim()).map(line=>`<li>${escapeHTML(line.replace(/^[-*]\s*/,''))}</li>`).join('')}</ul>`:''}${sections['CTA LABEL']?`<p style="padding:12px 20px;background:#252525;color:white;display:inline-block">${section('CTA LABEL')}</p>`:''}${sections['FOOTER NOTE']?`<footer style="border-top:1px solid #ddd;padding-top:20px;font-size:13px">${section('FOOTER NOTE')}</footer>`:''}`;
 }
 return `<!doctype html><html lang="${escapeHTML(lang)}" dir="${lang==='ar'?'rtl':'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; font-src data:; frame-src about:; base-uri 'none'; form-action 'none'"><title>${escapeHTML(title)}</title></head><body style="margin:0;background:#f6f4ef;color:#252525;font:16px/1.6 system-ui"><main style="max-width:640px;margin:24px auto;padding:32px;background:white">${piece.subject?`<h1 style="font-size:24px">${escapeHTML(piece.subject)}</h1>`:''}${piece.html?`<iframe title="${escapeHTML(title)}" sandbox="" style="border:0;width:100%;height:800px" srcdoc="${escapeHTML(piece.html)}"></iframe>`:`${image}${text}`}</main></body></html>`;
}
