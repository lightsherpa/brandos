// Read-only strategy review projection. Every statement is derived from the
// current claim ledger and recorded source rows; it never changes a decision.
import {safeEvidenceUrl} from './claim-ledger.js';
import {isBrandEvidenceSource} from './bio-source-policy.js';
import {diffBio} from './bio-diff.js';

export const certifyFrictionEnabled=()=>['1','true'].includes(String(process.env.CERTIFY_SIMPLIFY||process.env.CERTIFY_FRICTION||'').toLowerCase());
const LOCALES=['en','es','ar'];
const localized=fn=>Object.fromEntries(LOCALES.map(locale=>[locale,fn(locale)]));
const clip=(value,size=220)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,size);
const hasValue=value=>Array.isArray(value)?value.some(hasValue):typeof value==='string'?!!value.trim():value!=null;
function recordedValue(value){
 if(typeof value==='string'||typeof value==='number')return clip(value);
 if(Array.isArray(value))return clip(value.map(recordedValue).filter(Boolean).join(' · '));
 if(value&&typeof value==='object')return clip(value.name||value.claim||value.description||value.statement||'');
 return '';
}
// A field-specific decision lens, not a claim of strategic correctness.
const LENSES={
 'visual.logo':['Check the approved logo lockups on light and dark backgrounds.','Comprueba los logotipos aprobados sobre fondos claros y oscuros.','راجع الشعارات المعتمدة على الخلفيات الفاتحة والداكنة.'],
 'visual.palette':['Check primary colours, contrast and production uses.','Comprueba los colores principales, el contraste y los usos de producción.','راجع الألوان الأساسية والتباين واستخدامات الإنتاج.'],
 'visual.type':['Check the live font specimens and commercial usage rights.','Comprueba las muestras de tipografía y los derechos de uso comercial.','راجع نماذج الخطوط الحية وحقوق الاستخدام التجاري.'],
 'visual.imagery':['Compare the imagery direction with the recorded reference grid.','Compara la dirección fotográfica con las referencias registradas.','قارن توجه الصور بالمراجع المسجلة.'],
 'voice.register':['Check whether this voice can guide real production copy.','Comprueba si esta voz sirve para redactar textos reales.','تحقق مما إذا كان هذا الصوت يوجه كتابة النصوص الفعلية.'],
 'identity.positioning':[
  'Check whether this gives the audience a reason to choose the brand.',
  'Comprueba si ofrece al público una razón para elegir la marca.',
  'تحقق مما إذا كان هذا يمنح الجمهور سبباً لاختيار العلامة.'
 ],
 'identity.category':[
  'Check which alternatives this category puts the brand beside.',
  'Comprueba con qué alternativas se compara la marca en esta categoría.',
  'تحقق من البدائل التي تضع هذه الفئة العلامة بجانبها.'
 ],
 'identity.founded':[
  'Check the founding date against the recorded history.',
  'Contrasta la fecha de fundación con la historia registrada.',
  'تحقق من تاريخ التأسيس مقارنة بالتاريخ المسجل.'
 ],
 'identity.pillars':[
  'Check which principle wins when priorities compete.',
  'Comprueba qué principio prevalece cuando compiten las prioridades.',
  'تحقق من المبدأ الذي يتقدم عند تعارض الأولويات.'
 ],
 'audience.primary':[
  'Check that this is the customer the work should prioritise.',
  'Comprueba que este es el cliente que debe priorizar el trabajo.',
  'تحقق من أن هذا هو العميل الذي ينبغي أن يعطيه العمل الأولوية.'
 ],
 'audience.secondary':[
  'Check how this audience differs from the primary customer.',
  'Comprueba en qué se diferencia este público del cliente principal.',
  'تحقق من اختلاف هذا الجمهور عن العميل الأساسي.'
 ],
 'audience.tertiary':[
  'Check when this audience matters without displacing the primary customer.',
  'Comprueba cuándo importa este público sin desplazar al cliente principal.',
  'تحقق من أهمية هذا الجمهور دون إزاحة العميل الأساسي.'
 ],
 'audience.jtbd':[
  'Check which real customer situation the brand should solve.',
  'Comprueba qué situación real del cliente debe resolver la marca.',
  'تحقق من الموقف الفعلي للعميل الذي ينبغي أن تحله العلامة.'
 ],
 'goals.northStar':[
  'Check what measurable outcome would demonstrate progress.',
  'Comprueba qué resultado medible demostraría progreso.',
  'تحقق من النتيجة القابلة للقياس التي تثبت التقدم.'
 ],
 'goals.q2':[
  'Check the outcome and timeframe attached to this priority.',
  'Comprueba el resultado y el plazo asociados a esta prioridad.',
  'تحقق من النتيجة والإطار الزمني المرتبطين بهذه الأولوية.'
 ],
 'goals.q3':[
  'Check how this priority follows the preceding period.',
  'Comprueba cómo continúa esta prioridad el periodo anterior.',
  'تحقق من كيفية متابعة هذه الأولوية للفترة السابقة.'
 ],
 'positioning.frameOfReference':[
  'Check the comparison set a customer would actually use.',
  'Comprueba el marco de comparación que usaría un cliente real.',
  'تحقق من مجموعة المقارنة التي سيستخدمها العميل فعلياً.'
 ],
 'positioning.competitors':[
  'Check each named competitor against its own recorded source.',
  'Contrasta cada competidor con su propia fuente registrada.',
  'تحقق من كل منافس مذكور بالرجوع إلى مصدره المسجل.'
 ],
 'positioning.pointsOfDifference':[
  'Check what the brand can substantiate that alternatives cannot.',
  'Comprueba qué puede demostrar la marca que no puedan las alternativas.',
  'تحقق مما تستطيع العلامة إثباته ولا تستطيع البدائل تقديمه.'
 ],
 'positioning.pointsOfParity':[
  'Check which category expectations the brand must first meet.',
  'Comprueba qué expectativas de la categoría debe cumplir primero la marca.',
  'تحقق من توقعات الفئة التي يجب أن تلبيها العلامة أولاً.'
 ],
 'positioning.researchGaps':[
  'Check which missing evidence prevents a defensible strategic choice.',
  'Comprueba qué pruebas faltan para justificar una decisión estratégica.',
  'تحقق من الأدلة الناقصة التي تمنع اتخاذ قرار استراتيجي مدعوم.'
 ],
 'strategic.watchouts':[
  'Check which creative decision would trigger this risk.',
  'Comprueba qué decisión creativa activaría este riesgo.',
  'تحقق من القرار الإبداعي الذي قد يفعّل هذا الخطر.'
 ],
 'strategic.notList':[
  'Check a concrete example of work that must be rejected.',
  'Comprueba un ejemplo concreto de trabajo que deba rechazarse.',
  'تحقق من مثال محدد للعمل الذي يجب رفضه.'
 ],
 'aspirations.direction':[
  'Check the difference between the intended direction and current evidence.',
  'Comprueba la diferencia entre la dirección deseada y las pruebas actuales.',
  'تحقق من الفرق بين التوجه المقصود والأدلة الحالية.'
 ],
 'aspirations.notYetTrue':[
  'Check which ambitions still need evidence before use as claims.',
  'Comprueba qué aspiraciones necesitan pruebas antes de presentarse como afirmaciones.',
  'تحقق من الطموحات التي تحتاج إلى أدلة قبل استخدامها كادعاءات.'
 ],
 'aspirations.references':[
  'Check what to learn from these references without treating them as brand evidence.',
  'Comprueba qué aprender de estas referencias sin tratarlas como pruebas de la marca.',
  'تحقق مما يمكن تعلمه من هذه المراجع دون اعتبارها أدلة على العلامة.'
 ]
};
const QUESTIONS={
 'identity.positioning':['What makes this a reason to choose the brand over alternatives?','¿Qué convierte esto en una razón para elegir la marca frente a las alternativas?','ما الذي يجعل هذا سبباً لاختيار العلامة بدلاً من البدائل؟'],
 'identity.category':['Which alternatives do customers compare with the brand in this category?','¿Con qué alternativas comparan los clientes a la marca en esta categoría?','ما البدائل التي يقارنها العملاء بالعلامة في هذه الفئة؟'],
 'identity.founded':['Which source confirms this founding date?','¿Qué fuente confirma esta fecha de fundación?','ما المصدر الذي يؤكد تاريخ التأسيس هذا؟'],
 'identity.pillars':['Which principle should win when these priorities compete?','¿Qué principio debe prevalecer cuando compiten estas prioridades?','أي مبدأ ينبغي أن يتقدم عند تعارض هذه الأولويات؟'],
 'audience.primary':['Which customer situation makes this the priority audience?','¿Qué situación del cliente convierte a este público en prioritario?','ما الموقف الذي يجعل هذا الجمهور أولوية؟'],
 'audience.secondary':['How should we distinguish this group from the primary audience?','¿Cómo debemos distinguir este grupo del público principal?','كيف نميز هذه الفئة عن الجمهور الأساسي؟'],
 'audience.tertiary':['When should work address this group without displacing the primary audience?','¿Cuándo debe dirigirse el trabajo a este grupo sin desplazar al público principal?','متى ينبغي أن يخاطب العمل هذه الفئة دون إزاحة الجمهور الأساسي؟'],
 'audience.jtbd':['Which real customer example best supports this need?','¿Qué ejemplo real de un cliente respalda mejor esta necesidad?','ما المثال الفعلي من العملاء الذي يدعم هذه الحاجة أكثر؟'],
 'goals.northStar':['Which measurable outcome and timeframe would demonstrate progress?','¿Qué resultado medible y qué plazo demostrarían progreso?','ما النتيجة القابلة للقياس والإطار الزمني اللذان يثبتان التقدم؟'],
 'goals.q2':['Which outcome and deadline define success for this priority?','¿Qué resultado y qué plazo definen el éxito de esta prioridad?','ما النتيجة والموعد اللذان يحددان نجاح هذه الأولوية؟'],
 'goals.q3':['How does this priority build on the preceding period?','¿Cómo continúa esta prioridad el periodo anterior?','كيف تبني هذه الأولوية على الفترة السابقة؟'],
 'positioning.frameOfReference':['Which alternatives would a real customer use to compare the brand?','¿Qué alternativas usaría un cliente real para comparar la marca?','ما البدائل التي سيستخدمها العميل فعلياً لمقارنة العلامة؟'],
 'positioning.competitors':['Which recorded source confirms each competitor is relevant to this choice?','¿Qué fuente registrada confirma que cada competidor es relevante para esta decisión?','ما المصدر المسجل الذي يؤكد صلة كل منافس بهذا الاختيار؟'],
 'positioning.pointsOfDifference':['Which example or source proves this difference against alternatives?','¿Qué ejemplo o fuente demuestra esta diferencia frente a las alternativas?','ما المثال أو المصدر الذي يثبت هذا الاختلاف عن البدائل؟'],
 'positioning.pointsOfParity':['Which category expectations must the brand meet before making a difference?','¿Qué expectativas de la categoría debe cumplir la marca antes de diferenciarse?','ما توقعات الفئة التي يجب أن تلبيها العلامة قبل أن تتميز؟'],
 'positioning.researchGaps':['Which source or client answer would close this evidence gap?','¿Qué fuente o respuesta del cliente resolvería esta falta de pruebas?','ما المصدر أو إجابة العميل التي تسد هذه الفجوة في الأدلة؟'],
 'strategic.watchouts':['Which concrete creative choice would trigger this risk?','¿Qué decisión creativa concreta activaría este riesgo?','ما القرار الإبداعي المحدد الذي قد يفعّل هذا الخطر؟'],
 'strategic.notList':['Which example should the reviewer reject to enforce this boundary?','¿Qué ejemplo debe rechazar el revisor para respetar este límite?','ما المثال الذي ينبغي أن يرفضه المراجع للحفاظ على هذا الحد؟'],
 'aspirations.direction':['Which part describes the desired direction rather than a current capability?','¿Qué parte describe una dirección deseada en lugar de una capacidad actual?','أي جزء يصف التوجه المقصود بدلاً من قدرة حالية؟'],
 'aspirations.notYetTrue':['Which evidence would be needed before using this ambition as a current claim?','¿Qué pruebas harían falta para presentar esta aspiración como una afirmación actual?','ما الأدلة اللازمة قبل استخدام هذا الطموح كادعاء حالي؟'],
 'aspirations.references':['What should the brand learn from these references?','¿Qué debe aprender la marca de estas referencias?','ما الذي ينبغي أن تتعلمه العلامة من هذه المراجع؟']
};
const DEFAULT_LENS=['Review this choice against recorded Brand Core evidence.','Revisa esta decisión con las pruebas registradas de Brand Core.','راجع هذا الاختيار بالرجوع إلى أدلة Brand Core المسجلة.'];
const DEFAULT_QUESTION=['Which source or example would settle this choice?','¿Qué fuente o ejemplo resolvería esta decisión?','ما المصدر أو المثال الذي يحسم هذا الاختيار؟'];

const STATUS={
 missing:{en:'No value is recorded.',es:'No hay un valor registrado.',ar:'لم تُسجّل قيمة.'},
 conflict:{en:'Conflicting records need a human decision.',es:'Los registros contradictorios requieren una decisión humana.',ar:'تحتاج السجلات المتعارضة إلى قرار بشري.'},
 unsupported:{en:'This claim is marked unsupported.',es:'Esta afirmación está marcada como no respaldada.',ar:'هذا الادعاء مسجل على أنه غير مدعوم.'},
 aspiration:{en:'This is a stated ambition, not evidence of a current capability.',es:'Es una aspiración declarada, no una prueba de capacidad actual.',ar:'هذا طموح معلن وليس دليلاً على قدرة حالية.'},
 waiting:{en:'A client question is still open.',es:'Sigue abierta una pregunta al cliente.',ar:'لا يزال سؤال موجه للعميل مفتوحاً.'},
 no_source:{en:'No linked source excerpt supports a human acceptance yet.',es:'Aún no hay un extracto de fuente vinculado que respalde la aceptación humana.',ar:'لا يوجد حتى الآن مقتطف مصدر مرتبط يدعم القبول البشري.'},
 low_confidence:{en:'Source material is recorded, but confidence needs human review.',es:'Hay fuentes registradas, pero la confianza requiere revisión humana.',ar:'توجد مصادر مسجلة لكن مستوى الثقة يحتاج إلى مراجعة بشرية.'},
 supported:{en:'A linked source excerpt is available for human acceptance.',es:'Hay un extracto de fuente vinculado para la aceptación humana.',ar:'يتوفر مقتطف مصدر مرتبط للمراجعة والقبول البشري.'}
};

function citationsFor(claim,sources){
 const rows=new Map(sources.map(source=>[source.id,source]));
 return (claim.evidence||[]).flatMap(evidence=>{
  const source=rows.get(evidence.source_id);
  if(!source||!isBrandEvidenceSource(source)||source.signals?.purpose==='aspiration')return [];
  const quote=clip(evidence.quote||source.signals?.quote||source.signals?.snippet,600);
  const visualAsset=['1','true'].includes(String(process.env.CERTIFY_SIMPLIFY||'').toLowerCase())&&/^visual\./.test(claim.field_path)&&safeEvidenceUrl(evidence.asset_url||source.evidence_url);
  if(!quote&&!visualAsset)return [];
  return [{claim_id:claim.claim_id,source_id:source.id,label:clip(source.src||evidence.label||source.kind),quote,
   url:safeEvidenceUrl(source.src),asset_url:safeEvidenceUrl(source.evidence_url),page:evidence.page||null}];
 });
}
function reasonFor(claim,payload,citations){
 if((payload.conflicts||[]).some(conflict=>(conflict.field_path||conflict.field)===claim.field_path)||claim.level==='conflicting'||payload.fieldStatus?.[claim.field_path]==='conflicting')return 'conflict';
 if(payload.fieldStatus?.[claim.field_path]==='unsupported')return 'unsupported';
 if(!hasValue(claim.value))return 'missing';
 if(claim.field_path.startsWith('aspirations.')||payload.fieldStatus?.[claim.field_path]==='aspirational')return 'aspiration';
 if(claim.open_questions>0)return 'waiting';
 if(!citations.length)return 'no_source';
 if(!['high','confirmed','fixed'].includes(claim.level))return 'low_confidence';
 return 'supported';
}

export function buildStrategyAssist({job,bio,claims=[],sources=[],previousBio=null}={}){
 const payload=bio?.payload||{},changes=new Set(previousBio?diffBio(previousBio.payload||{},payload).map(change=>change.field):[]);
 const items=claims.filter(claim=>['1','true'].includes(String(process.env.CERTIFY_SIMPLIFY||'').toLowerCase())||!/^visual\.|^voice\./.test(claim.field_path||'')).map(claim=>{
  const citations=citationsFor(claim,sources),reasonCode=reasonFor(claim,payload,citations),value=recordedValue(claim.value),lens=LENSES[claim.field_path]||DEFAULT_LENS;
  const recommendation=['conflict','unsupported'].includes(reasonCode)?'flag':reasonCode==='supported'?'accept':'ask';
  return {claim_id:claim.claim_id,field_path:claim.field_path,recommendation,reasonCode,changed:changes.has(claim.field_path),openQuestions:Math.max(0,Number(claim.open_questions)||0),citations,
   assessment:localized(locale=>{const i=LOCALES.indexOf(locale);return ['1','true'].includes(String(process.env.CERTIFY_SIMPLIFY||'').toLowerCase())?`${STATUS[reasonCode][locale]} ${lens[i]}`:`${value?'“'+value+'” · ':''}${STATUS[reasonCode][locale]} ${lens[i]}`;}),
   question:localized(locale=>{const i=LOCALES.indexOf(locale),recorded=value?`“${value}”`: 'Brand Core';
    const question=(QUESTIONS[claim.field_path]||DEFAULT_QUESTION)[i];
    return locale==='es'?`Sobre ${recorded}: ${question}`:locale==='ar'?`بخصوص ${recorded}: ${question}`:`About ${recorded}: ${question}`;})};
 });
 const counts={accept:0,ask:0,flag:0,missingEvidence:0,openQuestions:0,changed:0};
 for(const item of items.filter(row=>!/^visual\.|^voice\./.test(row.field_path))){counts[item.recommendation]++;if(!item.citations.length)counts.missingEvidence++;counts.openQuestions+=item.openQuestions;if(item.changed)counts.changed++;}
 const hardClaimIds=items.filter(item=>!/^visual\.|^voice\./.test(item.field_path)&&item.recommendation!=='accept').sort((a,b)=>(a.recommendation==='flag'?0:1)-(b.recommendation==='flag'?0:1)).map(item=>item.claim_id);
 return {version:1,jobId:job?.id||null,bioVersion:bio?.version??null,claims:items,summary:{counts,hardClaimIds,text:localized(locale=>locale==='es'?`${counts.ask} decisiones estratégicas necesitan aclaración; ${counts.flag} requieren resolver un conflicto o falta de respaldo. ${counts.accept} tienen extractos vinculados para revisión humana. ${counts.changed} han cambiado desde la versión anterior.`:locale==='ar'?`${counts.ask} قرارات استراتيجية تحتاج إلى توضيح؛ و${counts.flag} تحتاج إلى حل تعارض أو غياب دعم. تتوفر مقتطفات مرتبطة للمراجعة البشرية لـ${counts.accept} قرارات. تغيرت ${counts.changed} منذ الإصدار السابق.`:`${counts.ask} strategy decisions need clarification; ${counts.flag} need a conflict or unsupported claim resolved. ${counts.accept} have linked excerpts for human review. ${counts.changed} changed since the prior version.`)}};
}
