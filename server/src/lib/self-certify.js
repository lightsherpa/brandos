// self-certify.js — shared Stage-1 client self-certification.
//
// Extracted from the bios POST /:brandId/self-certify handler so the M3
// discovery "attest" step and the standalone bios endpoint run the SAME gate:
// three affirmed statements, valid field marks, no missing high-importance
// field, and a minimum BIO score. On success it writes an immutable
// bio_attestations record (bound to the exact payload bytes) and flips
// bios.self_certified — which is what unlocks briefing.
//
// Pure-ish: all validation is a pure function of the arguments; the only side
// effects are the two Supabase writes on success. Failures return
// { ok:false, code, error, ... } (with an `error` message HTTP callers can
// pass straight through); success returns { ok:true, score }.

import {bioIntegrityError} from "./brand-source-integrity.js";
import { assignSteward } from "./assign-steward.js";
import { supabaseAdmin } from "./supabase.js";
import { computeFocus } from "./bio-focus.js";
import { payloadHash } from "./bio-hash.js";
import { selfCertScoreReport } from "./self-cert-floor.js";

/**
 * @param {object} args
 * @param {string}  args.brandId
 * @param {string}  args.bioId              the exact bios row being attested
 * @param {object}  args.payload            that row's BIO payload
 * @param {string}  args.userId             attesting user (auth.userId)
 * @param {object}  args.statements         { authority, reflects, aspirationalMarked }
 * @param {object}  [args.fieldMarks]       { "section.key": "accurate"|"aspirational" }
 * @param {string}  [args.statementVersion] attestation copy version (default "1")
 * @param {number}  [args.minScore]         override; else read the active rubric
 * @returns {Promise<{ok:true, score:number}|{ok:false, code:string, error:string}>}
 */
export async function selfCertifyBio({ brandId, bioId, payload, userId, statements, fieldMarks, statementVersion, minScore, review = null }) {
  const integrity=bioIntegrityError({payload},{id:brandId});
  if(integrity)return {ok:false,...integrity};
  const marks = (fieldMarks && typeof fieldMarks === "object") ? fieldMarks : {};
  const s = statements || {};
  const version = String(statementVersion || "1");
  const bio = payload || {};
  if(version!=="2"||!review)return {ok:false,code:"REVIEW_REQUIRED",error:"Review the exact BIO in the current confirmation flow"};

  // 1) All three attestation statements must be affirmed.
  if (![s.authority, s.reflects, s.aspirationalMarked].every(value => value === true)) {
    return { ok: false, code: "STATEMENTS_REQUIRED", error: "All three attestation statements must be confirmed" };
  }

  // 2) Any field mark that is present must be a known value.
  for (const [k, v] of Object.entries(marks)) {
    if (v !== "accurate" && v !== "aspirational") {
      return { ok: false, code: "BAD_MARK", error: `Invalid mark for ${k}` };
    }
  }

  // 3) No high-importance field may be missing.
  const highGaps = computeFocus(bio).filter((f) => f.status === "missing" && f.importance >= 1.0);
  if (highGaps.length) {
    return { ok: false, code: "HIGH_IMPORTANCE_GAPS", error: "Fill the high-importance fields before self-certifying", fields: highGaps.map((f) => f.field) };
  }

  // 4) Score must clear the self-cert floor (default 80, allowed 80–85).
  //    The Creative Director rubric does not set this gate.
  const report = selfCertScoreReport(bio, minScore);
  const { score } = report;
  if (!report.meetsFloor) {
    return {
      ok: false,
      code: "BELOW_MIN_SCORE",
      error: `BIO score ${score} is below the ${report.minScore} needed to self-certify`,
      score,
      minScore: report.minScore,
      sections: report.sections,
    };
  }

  // Record and unlock atomically; a failed attestation must never unlock briefing.
  const {data, error} = await supabaseAdmin.rpc("record_bio_self_certification", {
    p_bio_id:bioId, p_brand_id:brandId, p_user_id:userId,
    p_payload_hash:payloadHash(bio), p_statement_version:version,
    p_field_marks:marks, p_score:score, p_review:review,
  });
  if(error)return {ok:false,code:"ATTESTATION_FAILED",error:"Could not record certification. Please retry."};
  if(!data?.ok)return data||{ok:false,code:"ATTESTATION_FAILED",error:"Certification was not recorded."};
  await supabaseAdmin.from("discovery_sessions").update({status:"completed",updated_at:new Date().toISOString()}).eq("brand_id",brandId);
  const {data:existing}=await supabaseAdmin.from("steward_jobs").select("id").eq("bio_id",bioId).in("status",["queued","in_review","pending_lead_review"]).limit(1).maybeSingle();
  let reviewQueued=!!existing;
  if(!existing){
    const {data:job,error:queueError}=await supabaseAdmin.from("steward_jobs").insert({bio_id:bioId,brand_id:brandId,kind:"drift_check",status:"queued"}).select("id").single();
    reviewQueued=!!job||queueError?.code==="23505";
    if(job){try{await assignSteward(job.id);}catch{ /* remains queued for operations */ }}
  }
  return {...data, score, reviewQueued};
}
