// Test-only shared backing store: new application clients share these rows.
// Real SQL race/permissions tests run separately against an isolated Postgres.
import {randomUUID} from 'node:crypto';
export function testDatabase() {
  const budgets=new Map(),reservations=new Map(),runs=[],confirmations=[];
  const key=p=>JSON.stringify([p.p_brand_id,p.p_bio_version]);
  const fail=code=>({error:{message:code,code:'P0001'}});
  const db={budgets,reservations,runs,confirmations,async rpc(name,p){
    const k=key(p);let b=budgets.get(k);
    if(name==='certifier_acquire_run'){
      if(b?.active&&b.until>Date.now())return fail('CERTIFIER_BUSY');
      if(!b){b={spent:0,cap:0.3};budgets.set(k,b);}b.active=p.p_run_id;b.until=Date.now()+180000;
      return{data:{spent:b.spent,cap:b.cap}};
    }
    if(name==='certifier_release_run'){if(b?.active===p.p_run_id){b.active=null;return{data:true};}return{data:false};}
    if(name==='certifier_record_run'){
      if(!p.p_error&&(!b||b.active!==p.p_run_id||b.until<=Date.now()))return fail('CERTIFIER_BUSY');
      if(!runs.some(r=>r.id===p.p_run_id))runs.push({id:p.p_run_id,workspace_id:p.p_workspace_id,brand_id:p.p_brand_id,bio_id:p.p_bio_id,version:p.p_bio_version,brief:structuredClone(p.p_brief),status:p.p_error?'failed':'completed',created_at:new Date().toISOString()});
      return{data:null,error:null};
    }
    if(!b||b.active!==p.p_run_id||b.until<=Date.now())return fail('CERTIFIER_BUSY');
    if(name==='certifier_reserve_budget'){
      if(reservations.has(p.p_call_id))return{data:{spent:b.spent}};
      if(b.spent+p.p_est>0.3000000001)return fail('CERTIFIER_COST_CAP');
      b.spent=Number((b.spent+p.p_est).toFixed(9));b.until=Date.now()+180000;
      reservations.set(p.p_call_id,{est:p.p_est});return{data:{spent:b.spent}};
    }
    if(name==='certifier_settle_budget'){
      const r=reservations.get(p.p_call_id);if(!r)return fail('CERTIFIER_RESERVATION_MISSING');
      if(p.p_actual>r.est)return fail('CERTIFIER_COST_CAP');
      if(r.actual==null){b.spent=Number((b.spent-r.est+p.p_actual).toFixed(9));r.actual=p.p_actual;}
      return{data:{spent:b.spent}};
    }
    throw new Error(name);
  },from(table){const filters={};let insert;const q={select(){return q;},eq(k,v){filters[k]=v;return q;},order(){return q;},limit(){return q;},
    insert(row){insert=row;return q;},async single(){
      if(table==='certifier_claim_confirmations'){
        if(confirmations.some(r=>r.brand_id===insert.brand_id&&r.bio_version===insert.bio_version&&r.claim_id===insert.claim_id))return{error:{message:'duplicate',code:'23505'}};
        const row={id:randomUUID(),created_at:new Date().toISOString(),...insert};confirmations.push(row);return{data:structuredClone(row)};
      }
      return{data:{id:randomUUID()}};
    },async maybeSingle(){return{data:structuredClone(runs.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v)).at(-1)||null)};}};return q;}};
  return db;
}
