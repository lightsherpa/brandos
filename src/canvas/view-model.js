import {ct} from './copy.js';
export function versionsFor(node,runs) {
  if(!node)return [];
  return runs.filter(r=>r.canvas_node_id===node.id || (!r.canvas_node_id && node.legacyRunIds?.includes(r.id)));
}
export function pickedVersion(node,runs) {
  const versions=versionsFor(node,runs);
  const run=versions.find(r=>r.id===node?.pickedRunId);
  const output=run?.outputs?.find(o=>o.id===node?.pickedOutputId);
  return {run,output,versions};
}
export function outputText(output) {
  const b=output?.body;
  if(typeof b==='string')return b;
  if(b?.edited_text!=null)return b.edited_text;
  if(b?.text)return b.text;
  if(Array.isArray(b?.deliverables))return b.deliverables.map(d=>[d.title,d.body].filter(Boolean).join('\n')).join('\n\n');
  return '';
}
export function outputImages(output) {
  return [output?.body?.asset_url || output?.asset_url,...(output?.body?.deliverables || []).map(d=>d.asset_url || d.assetUrl)].filter(Boolean);
}
export function workflowActions(output,permissions,userId) {
  const has=p=>permissions.includes(p),status=output?.workflow_status;
  const actions=[];
  if(has('output.internal_submit') && ['draft','changes_requested_internal','changes_requested_client'].includes(status))actions.push(['submit_internal',ct("Send to steward")]);
  if(has('output.internal_approve') && status==='submitted_internal') {
    if(output.submitted_by!==userId)actions.push(['internal_approve',ct("Approve as steward")]);
    actions.push(['internal_changes',ct("Request changes")]);
  }
  if(has('output.internal_approve') && status==='internally_approved')actions.push(['send_client',ct("Send to client")]);
  if(has('output.client_approve') && status==='client_review')actions.push(['client_approve',ct("Approve")],['client_changes',ct("Request changes")]);
  return actions;
}
// Internal status codes stay stable across locale changes and CSS selectors.
export function statusCode(node,runs,busy) {
  const versions=versionsFor(node,runs);
  if(versions.some(r=>r.mediaState==='reconcile'||r.textState==='reconcile'))return 'reconcile';
  if(busy?.phase==='reconciling')return 'checking';
  if(busy?.phase==='failed')return 'failed';
  if(busy?.phase==='running'||versions.some(r=>['running','queued'].includes(r.status)))return 'running';
  const {output}=pickedVersion(node,runs);
  if(node.stale&&output)return 'stale';
  if(output?.workflow_status?.includes('approved'))return 'approved';
  if(output?.status==='flagged')return 'flagged';
  if(output)return 'ready';
  if(versions.at(-1)?.status==='failed')return 'failed';
  return node.type==='bio'?'source':node.type==='brief'?'brief':'not_run';
}
const labels={reconcile:'Needs reconciliation',checking:'Checking run',failed:'Failed',running:'Running',stale:'Inputs changed',approved:'Approved',flagged:'Flagged',ready:'Ready',source:'Source',brief:'Brief',not_run:'Not run'};
export function statusLabel(node,runs,busy){return ct(labels[statusCode(node,runs,busy)]);}
export function runStatusLabel(status){return ct(({completed:'Completed',queued:'Queued',running:'Running',failed:'Failed'})[status]||status);}
export function tierLabel(tier){return ct(({auto:'Auto',premium:'Premium',balanced:'Balanced',fast:'Fast'})[tier]||tier);}
export function workflowLabel(status){return ct(({draft:'Draft',submitted_internal:'Sent to steward',internally_approved:'Approved by steward',client_review:'Client review',client_approved:'Approved by client',changes_requested_internal:'Changes requested by steward',changes_requested_client:'Changes requested by client'})[status]||status);}
