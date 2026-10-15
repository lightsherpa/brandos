import {decodeReviewBody,reviewComponents} from '../../../src/lib/review-output.js';
export function replaceOutputComponent(original,component,{userId,now=new Date().toISOString()}={}) {
 if(!component || !Array.isArray(component.path) || typeof component.value!=='string' || !component.value.trim() || component.value.length>500000)throw new Error('Choose a component and provide its replacement.');
 const body=decodeReviewBody(original), found=reviewComponents(body).find(entry=>JSON.stringify(entry.path)===JSON.stringify(component.path));
 if(!found)throw new Error('This component is no longer available. Refresh the output.');
 if(found.type==='image') {
  let url;try{url=new URL(component.value);}catch{throw new Error('Provide a valid image URL.');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Use an HTTP or HTTPS image URL.');
 }
 if(found.type==='copy'&&/^[\[{]/.test(component.value.trim())) {try{JSON.parse(component.value);throw new Error('Use finished copy instead of JSON.');}catch(error){if(error.message==='Use finished copy instead of JSON.')throw error;}}
 const next=structuredClone(body);let target=next;
 for(const key of found.path.slice(0,-1))target=target[key];
 target[found.path.at(-1)]=component.value;
 next.component_edits=[...(Array.isArray(body.component_edits)?body.component_edits:[]),{path:found.path,before:found.value,after:component.value,by:userId,at:now}].slice(-100);
 next.edited_at=now;next.edited_by=userId;
 return next;
}
