import {supabaseAdmin} from './supabase.js';
import {maxTokensForDeliverables} from './deliverables.js';
export const TEXT_QA_ROUTE='openrouter/google/gemini-2.5-flash';
const fail=message=>{throw Object.assign(new Error(message),{code:'TEXT_SPEND_UNQUALIFIED',status:409});};
export function qualifiedTextBound(route,q,maxOutputTokens,now=Date.now()){
 if(!q||q.route!==route||q.enabled!==true||!q.evidence?.sourceUrl||!q.evidence?.artifact||!Number.isFinite(Date.parse(q.verified_at))||Date.parse(q.verified_at)>now||Date.parse(q.valid_until)<=Date.parse(q.verified_at)||Date.parse(q.valid_until)<=now||!Number.isFinite(Date.parse(q.valid_until)))fail('Qualify this text route and its billing bounds before canvas execution.');
 if(q.evidence.synthetic===true&&!/^http:\/\/127\.0\.0\.1:/.test(process.env.SUPABASE_URL||''))fail('Synthetic text qualification is local-only.');
 const b=q.bounds;
 const endpoint=route.startsWith('anthropic/')?(process.env.ANTHROPIC_BASE_URL||'https://api.anthropic.com').replace(/\/$/,'')+'/v1/messages':'https://openrouter.ai/api/v1/chat/completions';
 if(b?.endpoint!==endpoint)fail('The qualified billing endpoint does not match the configured adapter.');
 if(!Number.isInteger(maxOutputTokens)||!Number.isFinite(maxOutputTokens))fail('A finite integer output token cap is required.');
 if(!b||b.hardOutputCap!==true||b.allFeesIncluded!==true||b.fullContextBillingBound!==true||!Number.isInteger(b.contextTokens)||b.contextTokens<=0||!Number.isInteger(b.maxOutputTokens)||maxOutputTokens>b.maxOutputTokens||maxOutputTokens>b.contextTokens||maxOutputTokens<16)fail('The qualified text context/output limits do not cover this request.');
 for(const field of ['inputUsdPerMillionMax','outputUsdPerMillionMax','requestFeeUsdMax'])if(typeof b[field]!=='number'||!Number.isFinite(b[field])||b[field]<0)fail('Unknown text pricing or fees cannot authorize a canvas run.');
 if(route.startsWith('openrouter/')&&(!b.provider||typeof b.provider!=='string'))fail('Pin one qualified OpenRouter provider before canvas execution.');
 // Reserve the FULL qualified provider context, not a guessed character/token ratio.
 // Input max includes cache writes/long-context premiums; output max includes reasoning.
 const maxCostUsd=Math.ceil((b.contextTokens*b.inputUsdPerMillionMax/1e6+maxOutputTokens*b.outputUsdPerMillionMax/1e6+b.requestFeeUsdMax)*1e8)/1e8;
 if(maxCostUsd<=0)fail('A positive verified text bound is required.');
 return {route,qualificationId:q.id,qualificationVersion:q.version,validUntil:q.valid_until,maxTokens:maxOutputTokens,maxCostUsd,bounds:b};
}
export async function prepareTextSpend({workspaceId,spec,settings={},route},db=supabaseAdmin){
 const email=settings.deliverableSpec?.type==='email_html',count=email?0:settings.deliverableSpec?.count||1;
 const maxTokens=email?4000:settings.deliverableSpec?maxTokensForDeliverables({count,baseCr:spec.payload?.cr_estimate??8}):Math.max(16,(spec.payload?.cr_estimate??8)*100);
 const {data:rows,error}=await db.from('canvas_text_qualifications').select('*').eq('workspace_id',workspaceId).eq('enabled',true);
 if(error)fail('Text qualifications are unavailable.');
 const generation=qualifiedTextBound(route,rows?.find(q=>q.route===route),maxTokens);
 const qa=count?qualifiedTextBound(TEXT_QA_ROUTE,rows?.find(q=>q.route===TEXT_QA_ROUTE),400):null;
 const maxCostUsd=Math.ceil((generation.maxCostUsd+(qa?.maxCostUsd||0)*count)*1e8)/1e8;
 const {data:budget,error:be}=await db.from('api_budgets').select('*').eq('scope_type','workspace').eq('scope_key',workspaceId).eq('active',true).maybeSingle();
 if(be||!budget||!Number.isFinite(Number(budget.monthly_budget_usd))||Number(budget.monthly_budget_usd)<=0||!Number.isFinite(Number(budget.per_request_ceiling_usd))||Number(budget.per_request_ceiling_usd)<=0||Number(budget.per_request_ceiling_usd)<maxCostUsd)fail('Generation and all QA calls exceed the configured workspace spend ceiling.');
 return {version:1,maxCostUsd,generation,qa,qaCalls:count,routing:{mode:'off',maxCostUsd:0},deterministicQa:email};
}
export function boundedProviderOptions(plan){return {bounded:true,qualification:plan};}
export function aggregateQaUsage(results){
 const values=results.map(q=>q.usage?.cost_usd??q.usage?.cost??null),known=values.filter(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0);
 return {cost_usd:known.length===values.length?known.reduce((s,v)=>s+v,0):null,known_subtotal_usd:known.reduce((s,v)=>s+v,0),calls:values.length};
}
