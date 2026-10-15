// Private production state can retain checked source assets for repair. Only
// ready artifacts may cross read/export boundaries, regardless of current flags.
export const quarantinedItem = item => item?.quality_gated === true && !['ready','approved'].includes(item.status);
const decode = body => {if(typeof body!=='string')return body;try{return JSON.parse(body);}catch{return null;}};
export function hasQuarantinedOutput(body) {
 const decoded=decode(body);return !!decoded && (quarantinedItem(decoded)||quarantinedItem(decoded.item)||(Array.isArray(decoded.items)?decoded.items:[]).some(quarantinedItem));
}
export function sanitizeOutput(output) {
 const decoded=decode(output?.body);if(!decoded||typeof decoded!=='object'||!hasQuarantinedOutput(decoded))return output;
 const cleanItem=item=>quarantinedItem(item)?{...item,html:null,transport_html:null,image:item.image?{...item.image,asset_url:null}:null,before:item.before?{...item.before,image_url:null}:null}:item;
 let body={...decoded};
 if(Array.isArray(body.items))body.items=body.items.map(cleanItem);
 if(body.item)body.item=cleanItem(body.item);
 if(quarantinedItem(body))body=cleanItem(body);
 return {...output,asset_url:null,body:typeof output.body==='string'?JSON.stringify(body):body};
}
