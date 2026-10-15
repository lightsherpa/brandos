// Only presentation fields enter the CD's review surface. Operational payloads
// and JSON envelopes are never used as display fallbacks.
const TEXT = new Set(['text','edited_text','visual_direction','caption','subject','preheader','headline','heading','title','body','cta','description','alt','alt_text','content','visualDirection','narrative','pull_quote']);
const IMAGE = new Set(['asset_url','image_url','url']);
const NEST = new Set(['copy','items','item','snapshot','image','images','components','slides','sections','blocks','deliverables']);
export function decodeReviewBody(body) {
  if (typeof body !== 'string') return body && typeof body === 'object' ? body : {};
  try { const parsed=JSON.parse(body); return parsed && typeof parsed==='object' ? parsed : {text:String(parsed)}; }
  catch { return {text:body}; }
}
export function reviewComponents(body) {
  const decoded=decodeReviewBody(body), result=[];
  function walk(value,path=[],depth=0) {
    if(depth>12 || !value || typeof value!=='object')return;
    for(const [key,entry] of Object.entries(value)) {
      const next=[...path,key];
      if (key==='text' && typeof value.edited_text==='string') continue;
      if (typeof entry==='string' && entry.trim()) {
        let type=key==='html'?'email':IMAGE.has(key)&& /^https?:\/\//i.test(entry)?'image':TEXT.has(key)?'copy':null;
        if (!type || key==='url' && !path.some(k=>['image','images'].includes(k)))continue;
        // A serialized object is a transport envelope, never copy.
        if(type==='copy' && /^[\[{]/.test(entry.trim())) {try {JSON.parse(entry);continue;}catch{}}
        result.push({path:next,type,label:key,value:entry});
      } else if (Array.isArray(entry) && NEST.has(key)) entry.forEach((item,i)=>walk(item,[...next,i],depth+1));
      else if(NEST.has(key))walk(entry,next,depth+1);
    }
  }
  walk(decoded); return result;
}
export function reviewKind(kind,locale='en') {
 const index={onboarding:0,drift_check:1,renewal:2,recertification:2,task:3,task_rerun:3,image:4,email:5,copy:6}[kind]??7;
 const names={en:['Brand Core certification','Brand drift check','Brand Core update','Deliverable review','Image review','Email review','Copy review','Brand review'],es:['Certificación de Brand Core','Revisión de coherencia de marca','Actualización de Brand Core','Revisión de entrega','Revisión de imagen','Revisión de email','Revisión de texto','Revisión de marca'],ar:['اعتماد Brand Core','مراجعة اتساق العلامة','تحديث Brand Core','مراجعة المخرجات','مراجعة الصورة','مراجعة البريد','مراجعة النص','مراجعة العلامة']};
 const descriptions={en:['Review the brand strategy, visuals and voice.','Check whether the brand still matches its certified direction.','Review changes to the certified Brand Core.','Review the finished components before delivery.','Review the image before delivery.','Review the rendered email before delivery.','Review the written content before delivery.','Review the brand and its supporting evidence.'],es:['Revisa la estrategia, la identidad visual y la voz.','Comprueba la coherencia con la dirección certificada.','Revisa los cambios del Brand Core certificado.','Revisa los componentes antes de entregarlos.','Revisa la imagen antes de entregarla.','Revisa el email renderizado antes de entregarlo.','Revisa el texto antes de entregarlo.','Revisa la marca y sus evidencias.'],ar:['راجع الاستراتيجية والهوية البصرية والصوت.','تحقق من توافق العلامة مع توجهها المعتمد.','راجع تغييرات Brand Core المعتمد.','راجع المكونات النهائية قبل التسليم.','راجع الصورة قبل التسليم.','راجع البريد المعروض قبل التسليم.','راجع المحتوى المكتوب قبل التسليم.','راجع العلامة والأدلة الداعمة.']};
 return {label:(names[locale]||names.en)[index],description:(descriptions[locale]||descriptions.en)[index],icon:['check','search','refresh','check','canvas','mail','edit','check'][index]};
}
