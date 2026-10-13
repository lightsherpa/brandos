import {FoundationStrip} from "./brand-foundation.jsx";
import { withUploadType } from "./lib/upload-type.js";
import {useBrandFonts} from "./brand-fonts.jsx";
import {saveFixtureFoundation} from "./lib/ui-fixture.js";
import {scoreBio} from "../server/src/lib/score-bio.js";
import {foundationStatus,suggestColourRoles} from "../server/src/lib/brand-foundation.js";
import React from "react";
import {discoveryWebsiteError, bioIntegrityError} from "../server/src/lib/brand-source-integrity.js";
import {BioSelfCertification} from "./bio-self-certification.jsx";
import {watchDiscoveryBio} from "./lib/discovery-progress.js";
import {SectionTour} from "./section-tour.jsx";
import {validateUpload} from "../server/src/lib/ingest-guards.js";
import "./discovery-intake.css";
import {DiscoverySourceReferences} from "./discovery-source-references.jsx";
import {CompetitiveRecords,BioCompetitive} from "./bio-competitive.jsx";
import { useLocale, t as tr } from "./lib/i18n.js";
import { apiFetch, supabase } from "./lib/supabase-browser.js";
import { uiFixtureEnabled, FIXTURE_BIO_STATE, FIXTURE_SOURCES, publishReadProgress } from "./lib/ui-fixture.js";
import { BrandolphLine } from "./portal-shared.jsx";
const { BrandolphAvatar, BrandolphDot, Confidence, Counter, Icon, Reveal } = window;
/* Discovery (3-step intake) + BIO viewer. */

const { useState: useDState, useEffect: useDEffect } = React;
const DOCUMENT_FILE_ACCEPT = ".pdf,.doc,.docx,.txt,.md";
const SOURCE_FILE_ACCEPT = `${DOCUMENT_FILE_ACCEPT},.otf,.ttf,.woff,.woff2,image/*`;
const FONT_FILE_EXTS = new Set(["otf", "ttf", "woff", "woff2"]);
const fileExt = (file) => String(file?.name || "").split(".").pop().toLowerCase();
const visualFileKey = (file) => `${file?.name}:${file?.size}:${file?.lastModified}`;
const defaultVisualMeta = (file) => FONT_FILE_EXTS.has(fileExt(file))
  ? { assetRole:"font", fontFamily:String(file.name || "").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), fontUsage:"Display", licenseType:"commercial", licenseReference:"", rightsConfirmed:false }
  : { assetRole:"inspiration", rightsConfirmed:false };

/* useLiveBio — fetches the user's first brand + latest BIO + cert state.
   Polls every `pollMs` while `pendingCert` is true (BIO not yet certified
   by Steward, or no BIO at all yet). Returns { brandId, bio, cert, refresh }. */
function useLiveBio({ pollMs = 6000, brandId: fixedBrandId = null, enabled = true } = {}) {
  const [state, setState] = useDState(uiFixtureEnabled
    ? FIXTURE_BIO_STATE
    : { brandId: null, brandName: null, brandUrl: null, bio: null, cert: null, review: null, diff: [], reviewPending: false, focusCount: 0, error: null, loading: true });

  const requestVersion = React.useRef(0);
  const tick = React.useCallback(async () => {
    if (uiFixtureEnabled || !enabled) return;
    const version = ++requestVersion.current;
    const commit = value => { if (version === requestVersion.current) setState(value); };
    try {
      /* Resolve current user's brand. Prefers the workspace switcher's
         selection (from localStorage); falls back to the first brand. RLS
         scopes results to the user's workspaces. */
      const wantedId = fixedBrandId || window.getCurrentBrandId?.();
      let brand = null;
      if (wantedId) {
        const { data } = await supabase.from("brands").select("id, name, url").eq("id", wantedId).maybeSingle();
        brand = data;
      }
      if (wantedId && !brand) {
        commit((s) => ({ ...s, brandId: wantedId, brandName:null, brandUrl:null, review:null, diff:[], reviewPending:false, bio: null, cert: null, loading: false, error: "Brand is not available in this workspace" }));
        return;
      }
      if (!brand) {
        const { data: brands, error: bErr } = await supabase
          .from("brands").select("id, name, url").order("created_at", { ascending: true }).limit(1);
        if (bErr) throw bErr;
        brand = brands?.[0];
      }
      if (!brand) { commit((s) => ({ ...s, brandId: null, bio: null, cert: null, loading: false, error: "No brand in workspace" })); return; }
      const res = await apiFetch(`/api/bios/${brand.id}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        commit({ brandId: brand.id, brandName: brand.name, brandUrl: brand.url, bio: null, cert: null, review: null, diff: [], focusCount: 0, loading: false, error: j.error || `HTTP ${res.status}` });
        return;
      }
      const { bio, reviewPending, focusCount, review, diff } = await res.json();
      const mismatch = bio && (bio.brand_id !== brand.id ? {error:"The Brand Core does not match the selected brand"} : bioIntegrityError(bio, brand));
      if (mismatch) throw new Error(mismatch.error);
      let certInfo = null;
      if (bio?.certified) {
        let certName = "your Creative Director";
        if (bio.certified_by) {
          const { data: tm } = await supabase.from("team_members").select("first_name, name").eq("id", bio.certified_by).maybeSingle();
          certName = tm?.first_name || tm?.name || certName;
        }
        certInfo = { byName: certName, at: bio.certified_at, notes: bio.steward_notes || null };
      }
      commit({ brandId: brand.id, brandName: brand.name, brandUrl: brand.url, bio, cert: certInfo, review: review || null, diff: Array.isArray(diff) ? diff : [], reviewPending: !!reviewPending, focusCount: Number(focusCount) || 0, loading: false, error: null });
    } catch (e) {
      commit((s) => ({ ...s, bio:null, cert:null, review:null, diff:[], reviewPending:false, loading: false, error: e?.message || String(e) }));
    }
  }, [fixedBrandId, enabled]);

  useDEffect(() => {
    if (uiFixtureEnabled) {const changed=()=>setState({...FIXTURE_BIO_STATE,bio:{...FIXTURE_BIO_STATE.bio}});window.addEventListener("fixture:bio",changed);return ()=>window.removeEventListener("fixture:bio",changed);}
    if (!enabled) return undefined;
    let alive = true;
    const changed = () => {
      ++requestVersion.current;
      setState({ brandId: fixedBrandId || window.getCurrentBrandId?.() || null, brandName: null, brandUrl: null, bio: null, cert: null, review: null, diff: [], reviewPending: false, focusCount: 0, error: null, loading: true });
      tick();
    };
    changed();
    if (!fixedBrandId) window.addEventListener("brand:changed", changed);
    const interval = setInterval(() => { if (alive) tick(); }, pollMs);
    return () => { alive = false; ++requestVersion.current; clearInterval(interval); window.removeEventListener("brand:changed", changed); };
  }, [tick, pollMs, fixedBrandId, enabled]);

  return { ...state, refresh: tick };
}

function formatCertDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch { return ""; }
}

/* ════════════════════════════════════════════════════════════════ */
/* DISCOVERY — 3-step Mavity-style intake                            */

function DiscoveryStepper({ step }) {
  const { t } = useLocale();
  const steps = [
    { n:"01", label:t("discovery.stepper.connect") },
    { n:"02", label:t("discovery.stepper.extract") },
    { n:"03", label:t("discovery.stepper.confirm") },
  ];
  return <nav className="discovery-stepper" aria-label={t("title.discovery")}><ol>{steps.map((item,i)=><li key={item.n} className={i+1===step?"is-active":i+1<step?"is-complete":""} aria-current={i+1===step?"step":undefined}><span>{i+1<step?<Icon name="check" size={12}/>:item.n}</span>{item.label}</li>)}</ol><a href="#/home">{t("discovery.stepper.skip")}</a></nav>;
}

/* Three-bucket source intake drop zone (rev-2 §5.3) — labelled per bucket
   so Steward review can read by department without re-bucketing. Files
   upload to /api/bios/:brandId/sources/upload and land in Supabase Storage
   plus bio_sources/uploads rows with the selected bucket. */
const BUCKETS = [
  { key:"foundations" },
  { key:"visual" },
  { key:"voice" },
];

const fileKey=(bucket,purpose,file)=>`${bucket}:${purpose}:${file.name}:${file.size}:${file.lastModified}`;

function BucketDropZone({ bucket, files, onAdd, onRemove, statuses = {}, purpose, visualMeta = {}, onVisualMeta }) {
  const { t } = useLocale();
  const [over, setOver] = useDState(false);
  const inputRef = React.useRef(null);
  return <div className={`discovery-upload${over ? " is-over" : ""}`}
    onDragOver={e=>{e.preventDefault();setOver(true);}}
    onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);onAdd(Array.from(e.dataTransfer.files));}}>
    <input ref={inputRef} type="file" multiple accept={bucket.key === "visual" ? SOURCE_FILE_ACCEPT : DOCUMENT_FILE_ACCEPT} hidden
      onChange={e=>{onAdd(Array.from(e.target.files||[]));e.target.value="";}}/>
    <div className="discovery-upload-line"><span>{t("discovery.bucket."+bucket.key+".help")}</span>
      <button type="button" className="discovery-text-action" onClick={()=>inputRef.current?.click()}>{t("discovery.intake.browse")}</button></div>
    {files.length>0&&<ul className="discovery-file-list">{files.map((file,i)=>{
      const key=visualFileKey(file), meta=visualMeta[key]||defaultVisualMeta(file), isFont=FONT_FILE_EXTS.has(fileExt(file));
      const status=statuses[fileKey(bucket.key,purpose,file)];
      const setMeta=patch=>onVisualMeta?.(key,{...meta,...patch});
      return <li key={key}><div className="discovery-file-line"><span>{file.name}{status&&<span className={`discovery-file-status ${status.state}`} role={status.state==="error"?"alert":"status"}>{status.message}</span>}</span><small>{Math.ceil(file.size/1024)} KB</small><button type="button" className="discovery-icon-action" onClick={()=>onRemove(i)} aria-label={t("discovery.removeFile",{name:file.name})}>×</button></div>
        {bucket.key==="visual"&&<div className="discovery-visual-meta">
          {isFont?<>
            <label>{t("discovery.visualIntake.fontFamily")}<input value={meta.fontFamily||""} onChange={e=>setMeta({fontFamily:e.target.value})}/></label>
            <label>{t("discovery.visualIntake.fontUsage")}<select value={meta.fontUsage||"Display"} onChange={e=>setMeta({fontUsage:e.target.value})}>{["Display","Body","Both"].map(v=><option key={v} value={v}>{t("discovery.visualIntake."+v.toLowerCase())}</option>)}</select></label>
            <label>{t("discovery.visualIntake.fontLicence")}<select value={meta.licenseType||"commercial"} onChange={e=>setMeta({licenseType:e.target.value})}>{[["commercial","commercial"],["open_source","openSource"],["custom","custom"],["system","system"]].map(([v,k])=><option key={v} value={v}>{t("discovery.visualIntake."+k)}</option>)}</select></label>
            <label>{t("discovery.visualIntake.licenceReference")}<input value={meta.licenseReference||""} onChange={e=>setMeta({licenseReference:e.target.value})}/></label>
          </>:<label>{t("discovery.visualIntake.referenceRole")}<select value={meta.assetRole||"inspiration"} onChange={e=>setMeta({assetRole:e.target.value})}>{["canonical","inspiration","logo"].map(v=><option key={v} value={v}>{v === "logo" ? "Logo" : t("discovery.visualIntake."+v)}</option>)}</select></label>}
          {meta.assetRole === "logo" && <label>Logo variant<select value={meta.logoVariant || "light"} onChange={e=>setMeta({logoVariant:e.target.value})}><option value="light">Light logo (dark backgrounds)</option><option value="dark">Dark logo (light backgrounds)</option></select></label>}
          <label className="discovery-rights"><input type="checkbox" checked={!!meta.rightsConfirmed} onChange={e=>setMeta({rightsConfirmed:e.target.checked})}/>{t("discovery.visualIntake.rightsConfirm")}</label>
        </div>}
      </li>;
    })}</ul>}
  </div>;
}

function DiscoveryStep1({ onNext, onReview, newBrand = false }) {
  const { t } = useLocale();
  /* Three-bucket source state (rev-2 §5.3). Empty arrays on mount.
     `Start extraction` fires the compile-bio Inngest event via
     /api/discovery/start; the SPA can then poll bios for the result. */
  const [uploadsByBucket, setUploadsByBucket] = useDState({ foundations: [], visual: [], voice: [] });
  const [visualMeta, setVisualMeta] = useDState({});
  const [brandName, setBrandName] = useDState("");
  const [url, setUrl] = useDState("");
  const [instagram, setInstagram] = useDState("");
  const generated=useLiveBio({pollMs:10000});
  const [references, setReferences] = useDState([]);
  const [sourcePurposes,setSourcePurposes]=useDState({foundations:"current",visual:"current",voice:"current"});
  const [busy, setBusy] = useDState(false);
  const [error, setError] = useDState(null);
  const [fileStatuses,setFileStatuses]=useDState({});
  const [uploading, setUploading] = useDState(false);
  const [createdBrandId, setCreatedBrandId] = useDState(null);
  const uploadedFilesRef = React.useRef(new Set());
  const uploadedSourcesRef = React.useRef(new Map());
  const uploadKeyFor = (bucket, file) => fileKey(bucket,sourcePurposes[bucket],file);
  const addToBucket = (key) => (newFiles) => {
    setFileStatuses(prev=>{const next={...prev};for(const file of newFiles){const result=validateUpload({mime:file.type,size:file.size,filename:file.name});if(!result.ok)next[uploadKeyFor(key,file)]={state:"error",message:result.message};}return next;});
    setUploadsByBucket(prev => ({ ...prev, [key]: [...prev[key], ...newFiles.filter(file=>!prev[key].some(existing=>visualFileKey(existing)===visualFileKey(file)))] }));
    if (key === "visual") setVisualMeta(prev => {
      const next = { ...prev };
      newFiles.forEach((file) => { const k = visualFileKey(file); if (!next[k]) next[k] = defaultVisualMeta(file); });
      return next;
    });
  };
  const removeFromBucket = (key) => async (idx) => {
    const file = uploadsByBucket[key][idx];
    const uploadKey = file ? uploadKeyFor(key, file) : null;
    const durable = uploadKey ? uploadedSourcesRef.current.get(uploadKey) : null;
    if (durable) {
      const response = await apiFetch(`/api/bios/${durable.brandId}/sources/${durable.sourceId}`, { method:"DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setFileStatuses(prev=>({...prev,[uploadKey]:{state:"error",message:body.error || t("discovery.visualIntake.removeFailed")}}));
        return;
      }
      uploadedFilesRef.current.delete(uploadKey);
      uploadedSourcesRef.current.delete(uploadKey);
    }
    setUploadsByBucket(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
    if (key === "visual" && file) setVisualMeta(prev => { const next = { ...prev }; delete next[visualFileKey(file)]; return next; });
  };
  const updateVisualMeta = (key, value) => setVisualMeta(prev => ({ ...prev, [key]: value }));
  const handleStart = async () => {
    if (newBrand && !brandName.trim()) { setError(t("discovery.step1.brandNameRequired")); return; }
    const invalid={};
    for(const bucket of BUCKETS)for(const file of uploadsByBucket[bucket.key]){const result=validateUpload({mime:file.type,size:file.size,filename:file.name});if(!result.ok)invalid[fileKey(bucket.key,sourcePurposes[bucket.key],file)]={state:"error",message:result.message};}
    if(Object.keys(invalid).length){setFileStatuses(prev=>({...prev,...invalid}));return;}
    setBusy(true); setError(null);
    const attemptUploads = [];
    try {
      const cleaned = url.trim().replace(/^https?:\/\//i, "");
      const targetUrl = cleaned ? `https://${cleaned}` : undefined;
      /* New-brand mode: create the brand first, then run the same
         discovery flow targeting it. Existing onboarding (newBrand=false)
         skips this block entirely and behaves exactly as before. */
      let newBrandId = createdBrandId;
      if (newBrand && !newBrandId) {
        const created = await apiFetch("/api/brands", {
          method: "POST",
          body: JSON.stringify({ name: brandName.trim() }),
        });
        if (created.status === 402) {
          /* Over plan limit — bounce to upgrade, don't create/scrape. */
          window.location.hash = "#/upgrade";
          return;
        }
        if (!created.ok) {
          const err = await created.json().catch(() => ({ error: `HTTP ${created.status}` }));
          throw new Error(err.error || `HTTP ${created.status}`);
        }
        const { brand } = await created.json();
        newBrandId = brand.id;
        setCreatedBrandId(brand.id);
        window.setCurrentBrandId?.(brand.id);
      }
      let brandId = newBrandId || window.getCurrentBrandId?.();
      if (!brandId) {
        const { data: brands, error: brandErr } = await supabase.from("brands")
          .select("id").order("created_at", { ascending: true }).limit(1);
        if (brandErr) throw brandErr;
        brandId = brands?.[0]?.id;
      }
      if (!brandId) throw new Error("No brand is available for Discovery.");

      const {data: selectedBrand, error: selectedError} = await supabase.from("brands").select("id,name,url").eq("id",brandId).maybeSingle();
      if(selectedError || !selectedBrand)throw new Error("The selected brand is unavailable");
      const mismatch = discoveryWebsiteError(selectedBrand,targetUrl);
      if(mismatch)throw new Error(mismatch.error);
      let baselineVersion = 0;
      const baselineRes = await apiFetch(`/api/bios/${brandId}`);
      if (!baselineRes.ok) {const failure=await baselineRes.json().catch(()=>({}));throw new Error(failure.error || "The Brand Core could not be checked before uploading sources");}
      if (baselineRes.ok) {
        const baseline = await baselineRes.json();
        baselineVersion = Number(baseline.bio?.version) || 0;
      }
      const filesToUpload = BUCKETS.flatMap((bucket) =>
        uploadsByBucket[bucket.key].map((file) => ({ bucket: bucket.key, file }))
      );
      if (brandId && filesToUpload.length) {
        setUploading(true);
        let failedUpload=false;
        for (const item of filesToUpload) {
          const uploadKey = fileKey(item.bucket,sourcePurposes[item.bucket],item.file);
          if (uploadedFilesRef.current.has(uploadKey)) continue;
          const form = new FormData();
          form.set("bucket", item.bucket);
          form.set("purpose", sourcePurposes[item.bucket]);
          form.set("file", withUploadType(item.file));
          if (item.bucket === "visual") {
            const meta = visualMeta[visualFileKey(item.file)] || defaultVisualMeta(item.file);
            Object.entries(meta).forEach(([key, value]) => form.set(key, String(value)));
          }
          setFileStatuses(prev=>({...prev,[uploadKey]:{state:"uploading",message:t("discovery.upload.uploading")}}));
          try {
          const up = await apiFetch(`/api/bios/${brandId}/sources/upload`, {
            method: "POST",
            body: form,
          });
          if (!up.ok) {
            const err = await up.json().catch(() => ({ error: `HTTP ${up.status}` }));
            throw new Error(`Upload failed for ${item.file.name}: ${err.error || `HTTP ${up.status}`}`);
          }
          const uploaded = await up.json();
          const durable = { brandId, sourceId:uploaded.source?.id, uploadKey };
          if (!durable.sourceId) throw new Error(`Upload succeeded without a source id for ${item.file.name}`);
          uploadedFilesRef.current.add(uploadKey);
          uploadedSourcesRef.current.set(uploadKey, durable);
          attemptUploads.push(durable);
          setFileStatuses(prev=>({...prev,[uploadKey]:{state:"uploaded",message:t("discovery.upload.uploaded")}}));
          }catch(uploadError){failedUpload=true;setFileStatuses(prev=>({...prev,[uploadKey]:{state:"error",message:uploadError?.message||t("discovery.upload.failed")}}));}

        }
        if(failedUpload)return;
      }
      const res = await apiFetch("/api/discovery/start", {
        method: "POST",
        body: JSON.stringify({ url: targetUrl, instagram, brandId, references }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { discoveryId, eventId } = await res.json();
      const runId = discoveryId || eventId;
      if (!runId) throw new Error("Discovery started without a correlation id. Please retry.");
      console.log("[Discovery] fired", { discoveryId: runId, brandId, url: targetUrl });
      onNext({ discoveryId: runId, eventId, brandId, baselineVersion });
    } catch (err) {
      await Promise.all(attemptUploads.map(async (durable) => {
        try {
          const response = await apiFetch(`/api/bios/${durable.brandId}/sources/${durable.sourceId}`, { method:"DELETE" });
          if (response.ok) {
            uploadedFilesRef.current.delete(durable.uploadKey);
            uploadedSourcesRef.current.delete(durable.uploadKey);
          }
        } catch { /* keep the source tracked so the user can remove/retry */ }
      }));
      setError(err?.message || String(err));
    } finally {
      setUploading(false);
      setBusy(false);
    }
  };
  const totalFiles = BUCKETS.reduce((a, b) => a + uploadsByBucket[b.key].length, 0);
  const invalidFiles=BUCKETS.some(bucket=>uploadsByBucket[bucket.key].some(file=>!validateUpload({mime:file.type,size:file.size,filename:file.name}).ok));
  const visualAssetsReady = uploadsByBucket.visual.every((file) => {
    const meta = visualMeta[visualFileKey(file)] || defaultVisualMeta(file);
    return meta.rightsConfirmed && (!FONT_FILE_EXTS.has(fileExt(file)) || (meta.fontFamily && meta.licenseType));
  });

  const websiteMismatch=!newBrand && generated.brandUrl ? discoveryWebsiteError({name:generated.brandName,url:generated.brandUrl},url.trim()) : null;
  const referenceCount=references.filter(row=>row.url.trim()).length;
  const sourceCount=(url.trim()?1:0)+referenceCount+totalFiles;
  return <div className="discovery-intake">
    <SectionTour scope="discovery-intake" steps={[
      {target:"#discovery-brand-heading",title:t("discovery.tour.brandTitle"),text:t("discovery.tour.brandText")},
      {target:"#discovery-reference-heading",title:t("discovery.tour.referencesTitle"),text:t("discovery.tour.referencesText")},
      {target:".discovery-documents>details",title:t("discovery.tour.filesTitle"),text:t("discovery.tour.filesText")},
      {target:".discovery-intake-footer",title:t("discovery.tour.generateTitle"),text:t("discovery.tour.generateText")},
    ]}/>
    <header className="discovery-intake-heading"><span className="discovery-kicker">{t("discovery.intake.kicker")}</span>
      <h1>{t("discovery.intake.title")}</h1><p>{t("discovery.intake.lead")}</p></header>
    <div className="discovery-intake-layout"><div className="discovery-intake-main">
      <section className="discovery-intake-section" aria-labelledby="discovery-brand-heading">
        <div className="discovery-section-heading"><span className="discovery-section-number">01</span><div><h2 id="discovery-brand-heading">{t("discovery.intake.brand")}</h2><p>{t("discovery.intake.brandHelp")}</p></div></div>
        <div className="discovery-brand-fields">
          {newBrand&&<label htmlFor="discovery-brand-name">{t("discovery.step1.brandNameLabel")}<input id="discovery-brand-name" value={brandName} disabled={!!createdBrandId} onChange={e=>setBrandName(e.target.value)} placeholder={t("discovery.intake.namePlaceholder")}/></label>}
          <label htmlFor="discovery-brand-url">{t("discovery.step1.urlLabel")}<input id="discovery-brand-url" value={url} onChange={e=>setUrl(e.target.value)} placeholder={t("discovery.step1.urlPlaceholder")}/></label>
        </div>
        {!newBrand && generated.brandName && <p className="discovery-helper">{t("discovery.integrity.sourcesFor",{name:generated.brandName})}</p>}
        {websiteMismatch && <p role="alert" className="discovery-helper">{websiteMismatch.error}</p>}
        {createdBrandId&&<p className="discovery-helper">{t("discovery.intake.retryHelp")}</p>}
        <details className="discovery-social"><summary>{t("discovery.intake.social")}</summary><label htmlFor="discovery-instagram">{t("discovery.step1.igLabel")}<input id="discovery-instagram" value={instagram} onChange={e=>setInstagram(e.target.value)} placeholder={t("discovery.step1.igPlaceholder")}/></label><p className="discovery-helper">{t("discovery.intake.socialHelp")}</p></details>
      </section>
      <DiscoverySourceReferences items={references} onChange={setReferences}/>
      <section className="discovery-intake-section discovery-documents">
        <details open={totalFiles>0?true:undefined}><summary><span className="discovery-section-number">03</span><span>{t("discovery.intake.documents")}</span><small>{totalFiles?t("discovery.intake.fileCount",{count:totalFiles}):t("discovery.intake.optional")}</small></summary>
          <p className="discovery-helper">{t("discovery.intake.documentsHelp")}</p>
          {BUCKETS.map(bucket=><div className="discovery-file-group" key={bucket.key}><div className="discovery-file-group-heading"><h3>{t("discovery.bucket."+bucket.key+".label")}</h3><label><span className="sr-only">{t("discovery.sourcesIntake.filePurpose",{bucket:t("discovery.bucket."+bucket.key+".label")})}</span><select value={sourcePurposes[bucket.key]} disabled={uploadsByBucket[bucket.key].some(file=>uploadedSourcesRef.current.has(uploadKeyFor(bucket.key,file)))} onChange={e=>setSourcePurposes(prev=>({...prev,[bucket.key]:e.target.value}))}>{["current","aspiration"].map(key=><option key={key} value={key}>{t("discovery.sourcesIntake."+key)}</option>)}</select></label></div>
            <BucketDropZone bucket={bucket} statuses={fileStatuses} purpose={sourcePurposes[bucket.key]} files={uploadsByBucket[bucket.key]} onAdd={addToBucket(bucket.key)} onRemove={removeFromBucket(bucket.key)} visualMeta={visualMeta} onVisualMeta={updateVisualMeta}/>
          </div>)}
          <p className="discovery-helper">{t("discovery.intake.visualLimit")}</p>
        </details>
      </section>
      <footer className="discovery-intake-footer"><p>{t("discovery.intake.reviewHelp")}</p><button className="btn btn--primary" onClick={handleStart} disabled={!!websiteMismatch||busy||invalidFiles||!visualAssetsReady||(!url.trim()&&!totalFiles&&!referenceCount)||(newBrand&&!brandName.trim())}>{uploading?t("discovery.step1.uploading"):busy?t("discovery.step1.starting"):t("discovery.step1.startExtraction")}<Icon name="arrow" size={14}/></button></footer>
      {error&&<div className="discovery-intake-error" role="alert">{error}</div>}
      {!newBrand&&generated.bio?.discovery_id&&<button className="discovery-text-action" onClick={()=>onReview({brandId:generated.brandId,baselineVersion:generated.bio.version})}>{t("discovery.sourcesIntake.resumeReview")}</button>}
    </div><aside className="discovery-intake-aside" aria-label={t("discovery.intake.summary")}>
      <div className="discovery-source-summary"><span className="discovery-kicker">{t("discovery.intake.summary")}</span><strong>{String(sourceCount).padStart(2,"0")}</strong><span>{t("discovery.intake.sourceCount",{count:sourceCount})}</span></div>
      <h2>{t("discovery.intake.outputTitle")}</h2><ul><li>{t("discovery.intake.outputBrand")}</li><li>{t("discovery.intake.outputVisual")}</li><li>{t("discovery.intake.outputMarket")}</li></ul>
      <div className="discovery-intent-guide"><h3>{t("discovery.sourcesIntake.current")}</h3><p>{t("discovery.intake.currentHelp")}</p><h3>{t("discovery.sourcesIntake.aspiration")}</h3><p>{t("discovery.intake.aspirationHelp")}</p></div>
      {import.meta.env.VITE_DISCOVERY_TEST_ROUTE==="haiku-sonnet"&&<details className="discovery-test-details"><summary>{t("discovery.intake.testDetails")}</summary><p>Haiku 5.5 → Sonnet 5.5<br/>Gemini 3.8 Flash · {t("discovery.intake.visualRead")}</p><p>{t("discovery.intake.visualLimit")}</p></details>}
    </aside></div>
  </div>;
}

function DiscoveryStep2Running({ onDone, onExit, runContext }) {
  /* Keep checking the correlated BIO until it completes or this view unmounts. */
  const { t } = useLocale();
  const [stage, setStage] = useDState("scrape");                /* scrape → vision → compile → done */
  const [elapsed, setElapsed] = useDState(0);
  const [error, setError] = useDState(null);
  const [retryNonce, setRetryNonce] = useDState(0);

  const stages=['scrape','visual','read','research','synthesize','save'];
  const activeStage=stages.indexOf(stage);
  const lines=stages.map((key,index)=>({state:stage==='done'||index<activeStage?'ok':index===activeStage?'running':'queued',text:t('discovery.running.stage.'+key)}));

  useDEffect(() => {
    const startedAt = Date.now();
    setError(null);
    setElapsed(0);
    setStage("scrape");
    let completionTimer;
    const stop = watchDiscoveryBio({
      discoveryId: runContext?.discoveryId,
      read: async () => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        if(runContext?.discoveryId){
          const progress=await apiFetch(`/api/discovery/${runContext.discoveryId}/status`);
          if(progress.ok){
            const {run}=await progress.json();
            if(run?.stage){
              setStage(run.stage);
              const idx = stages.indexOf(run.stage);
              publishReadProgress({ done: idx >= 0 ? idx + 1 : 1, total: stages.length });
            }
            if(run?.status==='failed')throw Object.assign(new Error(run.error_code||'DISCOVERY_FAILED'),{terminal:true});
          }
        }
        const res = await apiFetch(`/api/bios/${runContext?.brandId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const {bio} = await res.json();
        return bio;
      },
      onStatus: failed => setError(failed ? t("discovery.running.reconnecting") : null),
      onFailure: failure=>setError(t("discovery.running.errors."+failure.message)),
      onComplete: () => {
        setStage("done");
        publishReadProgress(null);
        completionTimer = setTimeout(onDone, 400);
      },
    });
    return () => { stop(); clearTimeout(completionTimer); publishReadProgress(null); };
  }, [onDone, retryNonce, runContext?.brandId, runContext?.discoveryId]);

  const slow=elapsed>=120;
  return (
    <div style={{maxWidth: 760, margin:"40px auto 0"}}>
      <div style={{display:"flex", alignItems:"center", gap: 12, marginBottom: 18}}>
        <BrandolphDot state={stage === "done" ? "ok" : "thinking"} size={12} />
        <h2 style={{margin: 0, fontSize: 20}}>{stage === "done" ? t("discovery.step2.compiledTitle") : t("discovery.step2.readingTitle")}</h2>
      </div>
      {slow&&!error&&stage!=="done"&&<p role="status">{t("discovery.running.slow")}</p>}
      {error && <div className="card" style={{padding:14, marginBottom:14, borderColor:"var(--pink-500)"}}>
        <div style={{color:"var(--pink-600)", marginBottom:10}}>{error}</div>
        <div style={{display:"flex", gap:8}}>
          <button className="btn btn--ghost btn--sm" onClick={() => setRetryNonce(n => n + 1)}>Check again</button>
          <button className="btn btn--link" onClick={onExit}>Open current Brand Core</button>
        </div>
      </div>}
      <div className="card" style={{padding: 0, overflow:"hidden"}}>
        <div style={{padding:"16px 20px", borderBottom:"1px solid var(--c-line)", background:"var(--c-bg)"}}>
          <div style={{display:"flex", justifyContent:"space-between", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--c-dim)", letterSpacing:"0.06em"}}>
            <span>{t("discovery.step2.extraction")} · <span style={{color: stage === "done" ? "var(--green-600)" : "var(--yellow-700)"}}>{stage === "done" ? "100%" : t("discovery.running.processing")}</span></span>
            <span>{t("discovery.step2.elapsed", { sec: elapsed })}</span>
          </div>
          <div style={{height: 4, background:"var(--neutral-50)", borderRadius:999, marginTop: 10, overflow:"hidden"}}>
            <div className={stage==="done"?"":"discovery-progress-indeterminate"} style={{height:"100%", width: (stage === "done" ? 100 : 35) + "%", background: stage === "done" ? "var(--green-500)" : "var(--yellow-500)", borderRadius:999, transition:"width 800ms ease"}} />
          </div>
        </div>
        <div style={{padding: "18px 22px", borderLeft: "3px solid var(--yellow-500)", display:"flex", flexDirection:"column", gap: 10}} className="stream">
          {lines.map((l, i) => (
            <div key={i} style={{display:"flex", alignItems:"center", gap: 10, fontFamily:"var(--font-mono)", fontSize: 13, color:"var(--c-ink)"}}>
              <span style={{color:"var(--c-faint)"}}>›</span>
              <span className={"dot-state dot-state--" + l.state} />
              <span style={{color: l.state === "queued" ? "var(--c-faint)" : "var(--c-ink)"}}>{l.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   S3 DRAFT HUB + CHAPTERED REVIEW  (M3 discovery rebuild)
   Replaces the old hardcoded window.CI_DISCOVERY "Confirm" screen with
   the live discovery-session draft flow:
     GET   /api/discovery/session/:brandId          → seed on mount (create-on-read)
     PATCH /api/discovery/session/:brandId          → debounced autosave (~800ms)
     POST  /api/discovery/session/:brandId/attest   → promote draft → BIO + self-cert
     POST  /api/discovery/delegation                → hand a chapter to a teammate
   No invented brand data: a field with no value renders empty + flagged,
   never a guess.
   ─────────────────────────────────────────────────────────────────── */

/* Chapter map — one entry per BIO section, each with the 3–5 fields the
   user reviews. `multi` = string[] (chips); `list` = object[] (palette/type).
   Human-readable chapter/field labels + blurbs live in the i18n catalog under
   discovery.chapter.* / discovery.field.* and are resolved via the accessors
   below; the `key`s here stay language-neutral (they index draft/attest state). */
const DISCO_CHAPTERS = [
  { key:"identity", fields:[
    { key:"positioning", area:true, italic:true },
    { key:"category" },
    { key:"founded" },
    { key:"pillars", multi:true },
  ]},
  { key:"audience", fields:[
    { key:"primary",   area:true },
    { key:"secondary", area:true },
    { key:"tertiary",  area:true },
    { key:"jtbd",      multi:true },
  ]},
  { key:"positioning", fields:[
    { key:"frameOfReference", area:true },
    { key:"competitors", list:"competitors" },
    { key:"pointsOfDifference", list:"differences" },
    { key:"pointsOfParity", multi:true },
    { key:"researchGaps", multi:true },
  ]},
  { key:"voice", fields:[
    { key:"register",   area:true },
    { key:"rhythm",     area:true },
    { key:"forbidden",  multi:true },
    { key:"signatures", multi:true },
  ]},
  { key:"visual", fields:[
    { key:"palette", list:"palette" },
    { key:"type",    list:"type" },
    { key:"imagery", multi:true },
    { key:"avoid",   multi:true },
  ]},
  { key:"goals", fields:[
    { key:"northStar", area:true },
    { key:"q2",        area:true },
    { key:"q3",        area:true },
  ]},
  { key:"strategic", fields:[
    { key:"watchouts", multi:true },
    { key:"notList",   multi:true },
  ]},
];

/* i18n label accessors for the chapter map. These read the module-level `tr`
   with the live locale; the components that call them subscribe via useLocale()
   and re-render on locale change, so the resolved labels stay current. */
const chapterLabel = (ch) => tr("discovery.chapter." + ch.key + ".label");
const chapterBlurb = (ch) => tr("discovery.chapter." + ch.key + ".blurb");
const fieldLabel = (chapterKey, f) => tr("discovery.field." + chapterKey + "." + f.key);

function discoBlank(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return !v.some(item => typeof item === "string" ? item.trim() : item && typeof item === "object" && Object.entries(item).some(([key,val])=> !["id","type"].includes(key) && typeof val === "string" && val.trim()));
  if (typeof v === "string") return v.trim() === "";
  return false;
}

/* Per-field status → drives the chip + colour. A blank field is always
   "missing" (never surfaces a guessed value), regardless of any source. */
function discoFieldStatus({ value, meta, mark }) {
  /* `word` is resolved at render via t("discovery.fieldStatus." + kind). */
  if (discoBlank(value))       return { kind:"missing",      color:"var(--pink-500)" };
  if (mark === "accurate")     return { kind:"accurate",     color:"var(--green-600)" };
  if (mark === "aspirational") return { kind:"aspirational", color:"var(--purple-500)" };
  if (meta && meta.source)     return { kind:"inferred",     color:"var(--orange-600)" };
  return { kind:"review", color:"var(--orange-600)" };
}

/* Section roll-up for the Draft Hub cards + attest summary. */
function discoAnalyzeSection(chapter, draft, confMap, attested) {
  const sec = draft?.[chapter.key] || {};
  let confirmed = 0, toConfirm = 0, gaps = 0;
  for (const f of chapter.fields) {
    const st = discoFieldStatus({
      value: sec[f.key],
      meta: confMap[`${chapter.key}.${f.key}`],
      mark: attested[`${chapter.key}.${f.key}`],
    });
    if (st.kind === "missing") gaps++;
    else if (["inferred", "review"].includes(st.kind)) toConfirm++;
    else confirmed++;
  }
  const total = chapter.fields.length;
  let status;
  /* `word` is resolved at render via t("discovery.sectionStatus." + key). */
  if (gaps >= Math.ceil(total / 2)) status = { key:"needs",   color:"var(--pink-500)",   bg:"var(--pink-50, rgba(244,143,177,0.12))" };
  else if (gaps > 0 || toConfirm > 0) status = { key:"filling", color:"var(--orange-600)", bg:"var(--yellow-50, rgba(252,211,77,0.12))" };
  else status = { key:"well", color:"var(--green-600)", bg:"var(--green-50, rgba(127,163,122,0.12))" };
  return { confirmed, toConfirm, gaps, total, status };
}

/* Friendly copy for the attest endpoint's 400 codes. */
function discoAttestError(j) {
  switch (j && j.code) {
    case "STATEMENTS_REQUIRED":
      return tr("discovery.attestError.statements");
    case "HIGH_IMPORTANCE_GAPS":
      return tr("discovery.attestError.gaps", { fields: j.fields && j.fields.length ? `: ${j.fields.join(", ")}` : "" });
    case "BELOW_MIN_SCORE":
      return tr("discovery.attestError.belowScore", {
        score: j.score ?? "—",
        below: j.minScore ? tr("discovery.attestError.belowNeeded", { minScore: j.minScore }) : "",
      });
    default:
      return (j && j.error) || tr("discovery.attestError.default");
  }
}

/* Compact read/edit views for the object-array visual fields. */
function DiscoPaletteView({ items }) {
  return (
    <div style={{display:"flex", flexWrap:"wrap", gap:8}}>
      {items.map((c, i) => (
        <span key={i} style={{display:"inline-flex", alignItems:"center", gap:6, border:"1px solid var(--c-line)", borderRadius:8, padding:"3px 8px 3px 4px"}}>
          <span style={{width:18, height:18, borderRadius:4, background:c.hex || "#ccc", border:"1px solid var(--c-line)"}} />
          <span style={{fontSize:12.5, color:"var(--c-ink)"}}>{c.name || c.hex}</span>
        </span>
      ))}
    </div>
  );
}
function DiscoPaletteEdit({ items, onChange }) {
  const { t } = useLocale();
  const upd = (i, p) => onChange(items.map((x, j) => j === i ? { ...x, ...p } : x));
  return (
    <div style={{display:"flex", flexDirection:"column", gap:8}}>
      {items.map((c, i) => (
        <div key={i} style={{display:"flex", gap:8, alignItems:"center"}}>
          <input type="color" value={c.hex || "#888888"} onChange={(e) => upd(i, { hex: e.target.value })} style={{width:34, height:30, border:"none", background:"transparent", cursor:"pointer", padding:0}} />
          <div style={{flex:1}}><EditInput value={c.name || ""} onChange={(v) => upd(i, { name: v })} placeholder={t("discovery.palette.namePlaceholder")} /></div>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={CHIP_X} title={t("discovery.common.remove")}>×</button>
        </div>
      ))}
      <button className="btn btn--ghost btn--sm" onClick={() => onChange([...items, { hex:"#888888", name:"" }])}><Icon name="plus" size={12} /> {t("discovery.common.addColour")}</button>
    </div>
  );
}
function DiscoTypeView({ items }) {
  return (
    <div style={{display:"flex", flexWrap:"wrap", gap:8}}>
      {items.map((t, i) => (
        <span key={i} className="pill" style={{fontSize:12.5}}>{t.kind ? `${t.kind}: ` : ""}{t.family || "—"}</span>
      ))}
    </div>
  );
}
function DiscoTypeEdit({ items, onChange }) {
  const { t } = useLocale();
  const upd = (i, p) => onChange(items.map((x, j) => j === i ? { ...x, ...p } : x));
  return (
    <div style={{display:"flex", flexDirection:"column", gap:8}}>
      {items.map((tf, i) => (
        <div key={i} style={{display:"flex", gap:8, alignItems:"center"}}>
          <div style={{width:120}}><EditInput value={tf.kind || ""} onChange={(v) => upd(i, { kind: v })} placeholder={t("discovery.type.rolePlaceholder")} /></div>
          <div style={{flex:1}}><EditInput value={tf.family || ""} onChange={(v) => upd(i, { family: v })} placeholder={t("discovery.type.familyPlaceholder")} /></div>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={CHIP_X} title={t("discovery.common.remove")}>×</button>
        </div>
      ))}
      <button className="btn btn--ghost btn--sm" onClick={() => onChange([...items, { kind:"", family:"" }])}><Icon name="plus" size={12} /> {t("discovery.common.addTypeface")}</button>
    </div>
  );
}

/* One reviewable field: status chip, value (or "we couldn't find this"),
   and the per-field controls (mark accurate/aspirational, edit, leave blank). */
function DiscoFieldRow({ field, chapterKey, value, meta, mark, onChange, onMark, onLeaveBlank }) {
  const { t } = useLocale();
  const [editing, setEditing] = useDState(false);
  const st = discoFieldStatus({ value, meta, mark });
  const blank = st.kind === "missing";

  const renderValue = () => {
    if (["competitors","differences"].includes(field.list)) return <CompetitiveRecords kind={field.list} items={value || []} />;
    if (field.list === "palette") return <DiscoPaletteView items={value || []} />;
    if (field.list === "type") return <DiscoTypeView items={value || []} />;
    if (field.multi) return <div style={{display:"flex", flexWrap:"wrap", gap:6}}>{(value || []).map((v, i) => <span key={i} className="pill">{v}</span>)}</div>;
    return field.italic ? <em style={{fontStyle:"italic"}}>{value}</em> : <span>{value}</span>;
  };

  const renderEditor = () => {
    if (["competitors","differences"].includes(field.list)) return <CompetitiveRecords kind={field.list} items={value || []} editing onChange={onChange} />;
    if (field.list === "palette") return <DiscoPaletteEdit items={value || []} onChange={onChange} />;
    if (field.list === "type") return <DiscoTypeEdit items={value || []} onChange={onChange} />;
    if (field.multi) return <ChipEditor items={value || []} onChange={onChange} />;
    return <EditInput area={field.area} value={value || ""} onChange={onChange} placeholder={t("discovery.field.editPlaceholder")} />;
  };

  return (
    <div style={{padding:"16px 0", borderBottom:"1px solid var(--c-line)"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:12, marginBottom:8}}>
        <div>
          <span style={{fontFamily:"var(--font-mono)", fontSize:11, color:"var(--c-faint)", letterSpacing:"0.06em", textTransform:"uppercase"}}>{fieldLabel(chapterKey, field)}</span>
          {meta && meta.source && <span style={{fontSize:11, color:"var(--c-faint)", fontStyle:"italic", marginLeft:10}}>{t("discovery.field.from", { source: meta.source })}</span>}
        </div>
        <span className="pill" style={{background:"transparent", border:`1px solid ${st.color}`, color:st.color, fontSize:10.5, whiteSpace:"nowrap"}}>{t("discovery.fieldStatus." + st.kind)}</span>
      </div>

      {/* Value / editor / empty-state — NEVER a guessed value */}
      <div style={{
        borderLeft: `3px solid ${st.kind === "inferred" ? "var(--orange-600)" : st.kind === "missing" ? "var(--pink-500)" : "var(--c-line-2)"}`,
        background: st.kind === "inferred" ? "var(--yellow-50, rgba(252,211,77,0.08))" : st.kind === "missing" ? "var(--pink-50, rgba(244,143,177,0.06))" : "transparent",
        borderRadius:"0 8px 8px 0", padding:"10px 14px", fontSize:14, color:"var(--c-ink)", lineHeight:1.55,
      }}>
        {editing
          ? renderEditor()
          : blank
            ? <span style={{color:"var(--c-faint)", fontStyle:"italic"}}>{t("discovery.field.emptyState")}</span>
            : renderValue()}
      </div>

      {/* Per-field controls */}
      <div style={{display:"flex", gap:10, marginTop:10, flexWrap:"wrap", alignItems:"center"}}>
        {!blank && (mark ? (
          <button className="btn btn--link" style={{fontSize:12}} onClick={() => onMark(null)}>
            <Icon name="check" size={12} /> {t("discovery.field.markedUndo", { mark: t("discovery.mark." + mark) })}
          </button>
        ) : (
          <>
            <button className="btn btn--ghost btn--sm" onClick={() => onMark("accurate")}>{t("discovery.field.markAccurate")}</button>
            <button className="btn btn--ghost btn--sm" onClick={() => onMark("aspirational")}>{t("discovery.field.markAspirational")}</button>
          </>
        ))}
        <button className="btn btn--link" style={{fontSize:12}} onClick={() => setEditing(e => !e)}>
          <Icon name="edit" size={12} /> {editing ? t("discovery.field.doneEditing") : blank ? t("discovery.field.addIt") : t("discovery.field.edit")}
        </button>
        {!blank && (
          <button className="btn btn--link" style={{fontSize:12, color:"var(--c-faint)"}} onClick={() => { onLeaveBlank(); setEditing(false); }}>{t("discovery.field.leaveBlank")}</button>
        )}
      </div>
    </div>
  );
}

/* Hand a single chapter to a teammate — POST /discovery/delegation. */
function DiscoDelegatePanel({ brandId, chapter }) {
  const { t } = useLocale();
  const [email, setEmail] = useDState("");
  const [note, setNote] = useDState("");
  const [busy, setBusy] = useDState(false);
  const [link, setLink] = useDState(null);
  const [err, setErr] = useDState(null);
  const [copied, setCopied] = useDState(false);

  const send = async () => {
    if (!email.trim() || busy || !brandId) return;
    setBusy(true); setErr(null); setLink(null);
    try {
      const res = await apiFetch(`/api/discovery/delegation`, {
        method: "POST",
        body: JSON.stringify({ brandId, chapter: chapter.key, invitee_email: email.trim(), note: note.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setLink(j.link || null);
    } catch (e) { setErr(e?.message || String(e)); }
    finally { setBusy(false); }
  };
  const copy = () => { if (link && navigator.clipboard) { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); } };

  return (
    <div className="card card--inset" style={{padding:16, marginTop:18}}>
      <div style={{fontSize:13.5, fontWeight:600, color:"var(--c-ink)", marginBottom:4}}>{t("discovery.delegate.title")}</div>
      <div style={{fontSize:12, color:"var(--c-faint)", marginBottom:12}}>{t("discovery.delegate.desc", { chapter: chapterLabel(chapter) })}</div>
      <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
        <input className="input" style={{flex:"1 1 200px"}} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("discovery.delegate.emailPlaceholder")} />
        <input className="input" style={{flex:"1 1 200px"}} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("discovery.delegate.notePlaceholder")} />
        <button className="btn btn--primary btn--sm" disabled={busy || !email.trim()} onClick={send}>
          <Icon name="mail" size={13} /> {busy ? t("discovery.delegate.sending") : t("discovery.delegate.sendInvite")}
        </button>
      </div>
      {err && <div style={{fontSize:12, color:"var(--pink-500)", marginTop:8}}>{err}</div>}
      {link && (
        <div style={{marginTop:10, display:"flex", gap:8, alignItems:"center", fontSize:12}}>
          <span style={{color:"var(--green-600)", whiteSpace:"nowrap"}}>{t("discovery.delegate.inviteReady")}</span>
          <code style={{flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--c-dim)", background:"var(--neutral-50)", padding:"4px 8px", borderRadius:6}}>{link}</code>
          <button className="btn btn--ghost btn--sm" onClick={copy}>{copied ? t("discovery.delegate.copied") : t("discovery.delegate.copyLink")}</button>
        </div>
      )}
    </div>
  );
}

function DiscoveryStep2Results({ onConfirm, runContext }) {
  const { t } = useLocale();
  /* Live brand + cert + score — drives the Steward chip (flips in real
     time if certification lands) and the completion meter. */
  const live = useLiveBio({ pollMs: 6000, brandId: runContext?.brandId });
  const brandId = live.brandId;

  /* Discovery-session state, hydrated from GET /session on mount. */
  const [draft, setDraft] = useDState({});
  const [attested, setAttested] = useDState({});
  const [chapterStatus, setChapterStatus] = useDState({});
  const [cursor, setCursor] = useDState("hub");
  const [view, setView] = useDState("hub");                // hub | chapter | attest
  const [activeChapter, setActiveChapter] = useDState(null);
  const [loading, setLoading] = useDState(true);
  const [saveState, setSaveState] = useDState("idle");     // idle | saving | saved | error
  const [rev, setRev] = useDState(0);                      // bumps on every user edit → debounced save
  const [toast, setToast] = useDState(null);

  /* Attest UI */
  const [reviewBio,setReviewBio]=useDState(null);
  const [attestBusy, setAttestBusy] = useDState(false);
  const [attestErr, setAttestErr] = useDState(null);

  /* Refs mirror state so the debounced saver + attest flush always send
     the freshest snapshot without re-subscribing. */
  const draftRef = React.useRef(draft);
  const attestedRef = React.useRef(attested);
  const chapterStatusRef = React.useRef(chapterStatus);
  const cursorRef = React.useRef(cursor);
  const hydratedRef = React.useRef(false);
  useDEffect(() => { draftRef.current = draft; }, [draft]);
  useDEffect(() => { attestedRef.current = attested; }, [attested]);
  useDEffect(() => { chapterStatusRef.current = chapterStatus; }, [chapterStatus]);
  useDEffect(() => { cursorRef.current = cursor; }, [cursor]);

  const confMap = draft?.confidence || {};
  const bump = () => setRev(r => r + 1);
  const flash = (m) => { setToast(m); clearTimeout(window.__discoT); window.__discoT = setTimeout(() => setToast(null), 2600); };

  /* ── Load (create-on-read) ──────────────────────────────────────── */
  useDEffect(() => {
    if (!brandId) return;
    let alive = true;
    setLoading(true);
    hydratedRef.current = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/discovery/session/${brandId}`);
        const j = await res.json().catch(() => ({}));
        if (!alive) return;
        const s = j.session || {};
        setDraft(s.draft_payload || live.bio?.payload || {});
        setAttested(s.attested || {});
        setChapterStatus(s.chapter_status || {});
        const cur = typeof s.cursor === "string" && s.cursor ? s.cursor : "hub";
        setCursor(cur);
        if (cur.startsWith("chapter:")) { setActiveChapter(cur.slice("chapter:".length)); setView("chapter"); }
        else if (cur === "attest") setView("hub");
        else setView("hub");
      } catch (e) {
        /* Fall back to the live BIO payload so the user still sees real data. */
        if (alive) setDraft(live.bio?.payload || {});
      } finally {
        if (alive) { hydratedRef.current = true; setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, [brandId]);

  /* ── Debounced autosave ─────────────────────────────────────────── */
  const saveSession = React.useCallback(async () => {
    if (!brandId || !hydratedRef.current) return false;
    setSaveState("saving");
    try {
      const res = await apiFetch(`/api/discovery/session/${brandId}`, {
        method: "PATCH",
        body: JSON.stringify({
          draft_payload: draftRef.current,
          attested: attestedRef.current,
          chapter_status: chapterStatusRef.current,
          cursor: cursorRef.current,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveState("saved");
      return true;
    } catch (e) {
      setSaveState("error");
      return false;
    }
  }, [brandId]);

  useDEffect(() => {
    if (rev === 0 || !hydratedRef.current) return;
    const t = setTimeout(saveSession, 800);
    return () => clearTimeout(t);
  }, [rev, saveSession]);

  /* ── Field mutations (each bump schedules an autosave) ───────────── */
  const setFieldValue = (section, fkey, value) => {
    setDraft(d => ({ ...d, [section]: { ...(d[section] || {}), [fkey]: value } }));
    setAttested(a => { const next={...a}; delete next[`${section}.${fkey}`]; return next; });
    bump();
  };
  const setMark = (section, fkey, mark) => {
    const akey = `${section}.${fkey}`;
    setAttested(a => { const n = { ...a }; if (mark == null) delete n[akey]; else n[akey] = mark; return n; });
    bump();
  };
  const leaveBlank = (section, fkey) => {
    const cur = draft?.[section]?.[fkey];
    setFieldValue(section, fkey, Array.isArray(cur) ? [] : "");
    setMark(section, fkey, null);
  };

  /* ── Navigation (persists cursor + chapter progress) ────────────── */
  const openChapter = (key) => { setActiveChapter(key); setView("chapter"); setCursor(`chapter:${key}`); bump(); };
  const backToHub = (reviewedKey) => {
    if (reviewedKey) setChapterStatus(cs => ({ ...cs, [reviewedKey]: "reviewed" }));
    setView("hub"); setCursor("hub"); bump();
  };
  const openAttest = () => prepareReview();
  const saveAndExit = async () => { if (!(await saveSession())) return; flash(t("discovery.results.savedExit")); setTimeout(() => { window.location.hash = "#/home"; }, 700); };

  const prepareReview = async () => {
    if(attestBusy||!brandId)return;
    setAttestBusy(true);setAttestErr(null);
    try{
      if(!(await saveSession()))throw new Error(t("discovery.results.saveError"));
      const response=await apiFetch(`/api/discovery/session/${brandId}/prepare-review`,{method:"POST"});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);
      setReviewBio(body.bio);
    }catch(error){setAttestErr(error.message);}finally{setAttestBusy(false);}
  };

  /* ── Derived: per-section + overall roll-ups ────────────────────── */
  const analyses = DISCO_CHAPTERS.map(ch => ({ ch, a: discoAnalyzeSection(ch, draft, confMap, attested) }));
  const totals = analyses.reduce((acc, { a }) => ({
    confirmed: acc.confirmed + a.confirmed,
    toConfirm: acc.toConfirm + a.toConfirm,
    gaps: acc.gaps + a.gaps,
    total: acc.total + a.total,
  }), { confirmed:0, toConfirm:0, gaps:0, total:0 });

  const score = totals.total ? Math.round(100 * totals.confirmed / totals.total) : 0;
  const tone = score >= 85
    ? { color:"var(--green-600)", word:t("discovery.completion.well") }
    : score >= 65
    ? { color:"var(--orange-600)", word:t("discovery.completion.filling") }
    : { color:"var(--pink-500)", word:t("discovery.completion.needs") };

  const chapter = DISCO_CHAPTERS.find(c => c.key === activeChapter);
  const chapterAnalysis = chapter ? discoAnalyzeSection(chapter, draft, confMap, attested) : null;

  /* Still-open fields for the attest summary (missing or inferred). */
  const flaggedFields = [];
  analyses.forEach(({ ch }) => {
    ch.fields.forEach(f => {
      const st = discoFieldStatus({
        value: draft?.[ch.key]?.[f.key],
        meta: confMap[`${ch.key}.${f.key}`],
        mark: attested[`${ch.key}.${f.key}`],
      });
      if (st.kind === "missing" || ["inferred", "review"].includes(st.kind)) flaggedFields.push({ ch, f, st });
    });
  });


  const noBrand = !brandId && !live.loading;
  const showLoader = (!brandId && live.loading) || (brandId && loading);

  return (
    <div style={{maxWidth: 1080, margin:"24px auto 0"}}>
      {!showLoader&&!noBrand&&<SectionTour key={view==="chapter"?activeChapter:view} scope={`discovery-review-${view==="chapter"?activeChapter:view}`} steps={[
        {title:view==="chapter"?t("discovery.chapter."+activeChapter+".label"):t("discovery.tour.reviewTitle"),text:view==="chapter"?t("discovery.chapter."+activeChapter+".blurb")+" "+t("discovery.tour.chapterText"):t("discovery.tour.reviewText")},
        {title:t("discovery.tour.confirmTitle"),text:t("discovery.tour.confirmText")},
      ]}/>}
      {/* Utility row — save state + resume-anytime exit (on every screen) */}
      <div style={{display:"flex", justifyContent:"flex-end", alignItems:"center", gap:14, marginBottom:10}}>
        <span style={{color:"var(--c-faint)", fontFamily:"var(--font-mono)", fontSize:11}}>
          {saveState === "saving" ? t("discovery.results.saving") : saveState === "saved" ? t("discovery.results.saved") : saveState === "error" ? t("discovery.results.saveError") : ""}
        </span>
        <button className="btn btn--link" style={{fontSize:12}} onClick={saveAndExit}>{t("discovery.results.finishLater")}</button>
      </div>

      {noBrand ? (
        <div className="card" style={{padding:"48px 24px", textAlign:"center", color:"var(--c-dim)", fontSize:14}}>
          {t("discovery.results.noBrand")} <a href="#/discovery" style={{color:"var(--purple-500)"}}>{t("discovery.results.startDiscovery")}</a>.
        </div>
      ) : showLoader ? (
        <div className="card" style={{padding:"48px 24px", textAlign:"center", color:"var(--c-faint)", display:"flex", alignItems:"center", justifyContent:"center", gap:10}}>
          <BrandolphDot state="thinking" /> {t("discovery.results.loading")}
        </div>
      ) : (
        <>
          {/* Steward / cert chip — flips live if certification lands. */}
          <p className="bio-landscape-notice">{t("discovery.landscape.draftNotice")}</p>

          {/* Brand row + completion meter */}
          <Reveal>
            <div style={{display:"grid", gridTemplateColumns:"1fr auto", gap:20, alignItems:"center", marginBottom:20}}>
              <div>
                <div className="eyebrow" style={{marginBottom:6}}>{t("discovery.results.draftEyebrow")}</div>
                <h2 style={{margin:0, fontSize:24, letterSpacing:"-0.01em"}}>{live.brandName || t("discovery.results.yourBrand")}</h2>
                {live.brandUrl && <p style={{margin:"4px 0 0", color:"var(--c-dim)", fontSize:13}}>{live.brandUrl}</p>}
              </div>
              <div style={{textAlign:"right", minWidth:180}}>
                <div className="eyebrow eyebrow--yellow" style={{marginBottom:2}}>{t("discovery.results.completion")}</div>
                <div style={{fontFamily:"Georgia, serif", fontStyle:"italic", fontSize:44, lineHeight:1, color:tone.color, fontWeight:500}}>
                  <Counter to={score} format={n => Math.round(n)} />
                </div>
                <div style={{height:6, background:"var(--neutral-50)", borderRadius:999, overflow:"hidden", marginTop:8, width:180, marginLeft:"auto"}}>
                  <div style={{height:"100%", width: Math.max(0, Math.min(100, score)) + "%", background: tone.color, borderRadius:999, transition:"width 700ms ease"}} />
                </div>
                <div style={{fontFamily:"var(--font-mono)", fontSize:10, color:"var(--c-faint)", marginTop:4, textTransform:"uppercase", letterSpacing:"0.06em"}}>{tone.word}</div>
              </div>
            </div>
          </Reveal>

          {/* ── DRAFT HUB — chapter map ─────────────────────────────── */}
          {view === "hub" && (
            <>
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:14}}>
                {analyses.map(({ ch, a }) => {
                  const reviewed = chapterStatus[ch.key] === "reviewed";
                  return (
                    <button key={ch.key} onClick={() => openChapter(ch.key)} className="card"
                      style={{textAlign:"left", cursor:"pointer", padding:18, display:"flex", flexDirection:"column", gap:12, borderLeft:`3px solid ${a.status.color}`}}>
                      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:8}}>
                        <div style={{display:"flex", alignItems:"center", gap:8}}>
                          <h3 style={{margin:0, fontSize:16, letterSpacing:"-0.01em"}}>{chapterLabel(ch)}</h3>
                          {reviewed && <span style={{color:"var(--green-600)", display:"inline-flex"}} title={t("discovery.hub.reviewed")}><Icon name="check" size={13} /></span>}
                        </div>
                        <span className="pill" style={{background:a.status.bg, color:a.status.color, border:"none", fontSize:10.5, whiteSpace:"nowrap"}}>{t("discovery.sectionStatus." + a.status.key)}</span>
                      </div>
                      <p style={{margin:0, fontSize:12.5, color:"var(--c-faint)", lineHeight:1.45}}>{chapterBlurb(ch)}</p>
                      <div style={{display:"flex", gap:14, fontFamily:"var(--font-mono)", fontSize:11, color:"var(--c-dim)"}}>
                        <span>{t("discovery.hub.gaps", { count: a.gaps })}</span>
                        <span style={{color: a.toConfirm ? "var(--orange-600)" : "var(--c-faint)"}}>{t("discovery.hub.toConfirm", { count: a.toConfirm })}</span>
                        <span style={{color:"var(--green-600)"}}>{a.confirmed} ✓</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{marginTop:22, padding:"18px 20px", background:"var(--c-card)", border:"1px solid var(--c-line)", borderRadius:12, display:"flex", justifyContent:"space-between", alignItems:"center", gap:14, flexWrap:"wrap"}}>
                <div style={{fontSize:13.5, color:"var(--c-ink)"}}>
                  <strong>{totals.confirmed}/{totals.total}</strong> {t("discovery.hub.fieldsConfirmed")} · {totals.toConfirm} {t("discovery.hub.inferredToConfirm")} · {totals.gaps} {t("discovery.hub.gapsWord")}
                </div>
                <button className="btn btn--primary btn--lg" onClick={openAttest}>{t("discovery.hub.confirmAttest")} <Icon name="arrow" size={14} /></button>
              </div>
            </>
          )}

          {/* ── CHAPTER — field-level review ────────────────────────── */}
          {view === "chapter" && chapter && (
            <>
              <button className="btn btn--link" style={{marginBottom:10, fontSize:13}} onClick={() => backToHub(chapter.key)}>{t("discovery.chapterView.allChapters")}</button>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:12, marginBottom:4}}>
                <h2 style={{margin:0, fontSize:22, letterSpacing:"-0.01em"}}>{chapterLabel(chapter)}</h2>
                {chapterAnalysis && <span className="pill" style={{background:chapterAnalysis.status.bg, color:chapterAnalysis.status.color, border:"none"}}>{t("discovery.sectionStatus." + chapterAnalysis.status.key)}</span>}
              </div>
              <p style={{margin:"0 0 16px", fontSize:13, color:"var(--c-faint)"}}>{chapterBlurb(chapter)} {t("discovery.chapterView.instruction")}</p>

              <div className="card" style={{padding:"4px 20px"}}>
                {chapter.fields.map(field => (
                  <DiscoFieldRow
                    key={field.key}
                    field={field}
                    chapterKey={chapter.key}
                    value={draft?.[chapter.key]?.[field.key]}
                    meta={confMap[`${chapter.key}.${field.key}`]}
                    mark={attested[`${chapter.key}.${field.key}`]}
                    onChange={(v) => setFieldValue(chapter.key, field.key, v)}
                    onMark={(m) => setMark(chapter.key, field.key, m)}
                    onLeaveBlank={() => leaveBlank(chapter.key, field.key)}
                  />
                ))}
              </div>

              <DiscoDelegatePanel brandId={brandId} chapter={chapter} />

              <div style={{display:"flex", gap:10, marginTop:18}}>
                <button className="btn btn--primary" onClick={() => backToHub(chapter.key)}><Icon name="check" size={14} /> {t("discovery.chapterView.doneBack")}</button>
              </div>
            </>
          )}


        </>
      )}

      {attestErr&&<p className="discovery-intake-error" role="alert">{attestErr}</p>}
      {reviewBio&&<BioSelfCertification brandId={brandId} brandName={live.brandName} bio={reviewBio} initiallyOpen onClose={()=>setReviewBio(null)} onDone={()=>{setReviewBio(null);live.refresh();onConfirm?.();}} renderSection={section=><BioReviewSection payload={reviewBio.payload} section={section}/>}/>}
      {/* Learning toast */}
      {toast && (
        <div style={{position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", zIndex:60, background:"var(--c-inverse)", color:"#fff", borderRadius:10, padding:"11px 18px", fontSize:13.5, boxShadow:"var(--shadow-lg)", display:"flex", alignItems:"center", gap:9, maxWidth:560}}>
          <BrandolphDot /> {toast}
        </div>
      )}
    </div>
  );
}

function DiscoveryStep3({ go, runContext }) {
  const { t } = useLocale();
  const live = useLiveBio({ pollMs: 10000, brandId: runContext?.brandId });
  const positioning = live.bio?.payload?.identity?.positioning || "the clearest supported version of your positioning";
  const gapCount = Array.isArray(live.bio?.payload?.missing) ? live.bio.payload.missing.length : 0;
  return (
    <div style={{maxWidth: 580, margin:"80px auto 0", textAlign:"center"}}>
      <div style={{display:"flex", justifyContent:"center", marginBottom: 22}}>
        <BrandolphAvatar size={64} />
      </div>
      <h1 style={{fontSize: 28, letterSpacing:"-0.01em", marginBottom: 14}}>{t("discovery.step3.title")}</h1>
      <div className="stream" style={{display:"flex", flexDirection:"column", gap: 12, marginBottom: 28, textAlign:"left"}}>
        <BrandolphLine html={`*I've read the sources for ${live.brandName || "your brand"}.* The Brand Core now anchors on: ${positioning}`} />
        <BrandolphLine html={`*Two things to know before we go further.* One — the Brand Core is editable. If I got something wrong, fix it. Two — I don't pretend to know what I don't know. I left ${gapCount} ${gapCount === 1 ? "field" : "fields"} flagged for evidence or Steward review.`} />
        <BrandolphLine html="*The first brief is on you.* When you have something to ship, brief me on the change you want — not the deliverable. I'll do the deliverable part." />
      </div>
      <button className="btn btn--primary btn--lg" onClick={() => go("home")}>
        {t("discovery.step3.openBrandolph")} <Icon name="arrow" size={14} />
      </button>
    </div>
  );
}

function Discovery({ go, newBrand = false }) {
  const [step, setStep] = useDState(1);
  const [phase, setPhase] = useDState("form"); // form | running | results
  const [runContext, setRunContext] = useDState(null);
  return (
    <div className="discovery-flow" style={{padding:"24px 36px 60px", maxWidth: 1180, margin:"0 auto"}}>
      <DiscoveryStepper step={step} />
      {step === 1 && <DiscoveryStep1 newBrand={newBrand} onReview={context=>{setRunContext(context);setStep(2);setPhase("results");}} onNext={(context) => { setRunContext(context); setStep(2); setPhase("running"); }} />}
      {step === 2 && phase === "running"  && <DiscoveryStep2Running runContext={runContext} onDone={() => setPhase("results")} onExit={() => go("bio")} />}
      {step === 2 && phase === "results"  && <DiscoveryStep2Results runContext={runContext} onConfirm={() => setStep(3)} />}
      {step === 3 && <DiscoveryStep3 go={go} runContext={runContext} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/* BIO VIEWER                                                        */

/* ─── API payload ↔ BioFieldList shape mappers ─────────────────────
   The BIO viewer's tabs render flat arrays of `{ label, value, multi? }`.
   The API payload is nested per-section. These functions translate
   between the two so we can keep the existing UI but consume real data.
   Round-trip stable: payloadToFields → user edits → fieldsToPayload =
   the same shape the API expects. */
function payloadToFields(payload) {
  const p = payload || {};
  /* Live confidence map: payload.confidence["<section>.<key>"] = { conf, source }.
     Old BIOs have no map → cf() returns {} → conf/source stay undefined and the
     downstream Confidence/EditableField components render exactly as before. */
  const cmap = p.confidence || {};
  const fieldMeta = p.fieldMeta || {};
  const cf = (section, key) => cmap[`${section}.${key}`] || {};
  const field = (section, key, label, extra = {}) => {
    const { conf, source } = cf(section, key);
    const meta = fieldMeta?.[section]?.[key] || {};
    return { key, label: meta.label || label, conf, source, ...extra, ...(typeof meta.multi === "boolean" ? { multi: meta.multi } : {}) };
  };
  const humanize = (key) => String(key)
    .replace(/^custom_/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
  const customFields = (section, known) => Object.entries(p[section] || {})
    .filter(([key]) => !known.includes(key))
    .map(([key, value]) => ({
      ...field(section, key, humanize(key), { multi: Array.isArray(value) }),
      value,
    }));
  return {
    identity: [
      { ...field("identity", "positioning", "Positioning", { italic: true }), value: p.identity?.positioning || "" },
      { ...field("identity", "category", "Category"), value: p.identity?.category || "" },
      { ...field("identity", "founded", "Founded"),   value: p.identity?.founded || "" },
      { ...field("identity", "pillars", "Pillars", { multi: true }), value: p.identity?.pillars || [] },
      ...customFields("identity", ["positioning", "category", "founded", "pillars"]),
    ],
    positioning: p.positioning || {},
    audience: [
      { ...field("audience", "primary", "Primary"),     value: p.audience?.primary || "" },
      { ...field("audience", "secondary", "Secondary"), value: p.audience?.secondary || "" },
      { ...field("audience", "tertiary", "Tertiary"),   value: p.audience?.tertiary || "" },
      { ...field("audience", "jtbd", "Jobs to be done", { multi: true }), value: p.audience?.jtbd || [] },
      ...customFields("audience", ["primary", "secondary", "tertiary", "jtbd"]),
    ],
    voice: [
      { ...field("voice", "register", "Register"),    value: p.voice?.register || "" },
      { ...field("voice", "forbidden", "Forbidden", { multi: true }), value: p.voice?.forbidden || [] },
      { ...field("voice", "rhythm", "Rhythm"),        value: p.voice?.rhythm || "" },
      { ...field("voice", "signatures", "Signatures", { multi: true }), value: p.voice?.signatures || [] },
      ...customFields("voice", ["register", "forbidden", "rhythm", "signatures"]),
    ],
    goals: [
      { ...field("goals", "northStar", "North star"), value: p.goals?.northStar || "" },
      { ...field("goals", "q2", "This quarter"),      value: p.goals?.q2 || "" },
      { ...field("goals", "q3", "Next quarter"),      value: p.goals?.q3 || "" },
      ...customFields("goals", ["northStar", "q2", "q3"]),
    ],
    strategic: {
      watchouts: p.strategic?.watchouts || [],
      notList:   p.strategic?.notList || [],
      /* Gaps now come from the live payload's `missing` list (each
         { field, why }). The Gaps list + StringListEditor render plain
         strings, so flatten each entry to "field — why". Old BIOs have no
         `missing` → empty → UI hides it. Tolerate plain strings too. */
      gaps:      (p.missing || []).map(m =>
                   typeof m === "string" ? m
                   : [m?.field, m?.why].filter(Boolean).join(" — ")),
      diagnosis: p.strategic?.diagnosis || "",
    },
    /* Visual tab consumes these arrays directly. */
    palette: p.visual?.palette || [],
    type:    p.visual?.type || [],
    imagery: p.visual?.imagery || [],
    avoid:   p.visual?.avoid || [],
    grade:   p.visual?.grade || "",
  };
}

function fieldsToPayload(bio, prevPayload) {
  const toSection = (fields) => Object.fromEntries((fields || []).map((f) => [f.key, f.value]));
  const confidence = { ...(prevPayload?.confidence || {}) };
  const fieldMeta = { ...(prevPayload?.fieldMeta || {}) };
  for (const [section, fields] of [["identity", bio.identity], ["audience", bio.audience], ["voice", bio.voice], ["goals", bio.goals]]) {
    for (const key of Object.keys(confidence)) {
      if (key.startsWith(`${section}.`)) delete confidence[key];
    }
    fieldMeta[section] = {};
    for (const f of fields || []) {
      const parsedConfidence = Number(f.conf);
      if (Number.isFinite(parsedConfidence)) confidence[`${section}.${f.key}`] = { conf: parsedConfidence, source: f.source || "manual entry" };
      fieldMeta[section][f.key] = { label: f.label || f.key, multi: !!f.multi };
    }
  }
  const missing = (bio.strategic?.gaps || []).filter(Boolean).map((entry) => {
    const [field, ...why] = String(entry).split(" — ");
    return { field: why.length ? field : "manual", why: why.length ? why.join(" — ") : field };
  });
  return {
    ...(prevPayload || {}),
    confidence,
    fieldMeta,
    missing,
    identity: toSection(bio.identity),
    audience: toSection(bio.audience),
    voice: toSection(bio.voice),
    goals: toSection(bio.goals),
    positioning: bio.positioning || prevPayload?.positioning || {},
    strategic: {
      ...(prevPayload?.strategic || {}),
      watchouts: bio.strategic?.watchouts || [],
      notList:   bio.strategic?.notList || [],
      diagnosis: bio.strategic?.diagnosis || "",
    },
    visual: {
      ...(prevPayload?.visual || {}),
      palette: bio.palette || [],
      type:    bio.type || [],
      imagery: bio.imagery || [],
      avoid:   bio.avoid || [],
      grade:   bio.grade || "",
    },
  };
}

/* humanizeReasonCode — turn a Steward `reject_reason_code` (snake_case enum)
   into human-readable copy. Known codes get curated phrasing; anything else
   falls back to Title Case so the client never sees a raw enum value. */
function humanizeReasonCode(code) {
  if (!code) return "";
  const known = new Set([
    "insufficient_evidence", "out_of_scope", "brand_mismatch", "inaccurate",
    "incomplete", "low_quality", "aspirational_unmarked", "needs_sources", "duplicate",
  ]);
  if (known.has(code)) return tr("discovery.reasonCode." + code);
  /* Unknown enum → Title Case fallback (never surface a raw snake_case value). */
  return String(code).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* diffText — render a before/after value that may be a string, array, or
   object. Empty/missing values show as an em dash so a "→ —" reads cleanly. */
function diffText(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") { try { return JSON.stringify(v); } catch { return String(v); } }
  return String(v);
}

/* StewardReviewPanel — "From your Steward". Surfaces the Steward's decision
   when it needs the client's attention: requested changes, a returned BIO, or
   conditions attached to certification. Styled to match the cert chip (card +
   left accent + eyebrow). `approve` / null render nothing. */
function StewardReviewPanel({ review, onEdit }) {
  const { t } = useLocale();
  const decision = review?.decision;
  if (!decision || !["return_changes", "reject", "approve_with_conditions"].includes(decision)) return null;

  const by = review.steward_first_name || t("discovery.steward.defaultName");
  const when = formatCertDate(review.decided_at);
  const notes = review.steward_notes;

  /* Per-decision presentation. All colors come from tokens, never literals. */
  const cfg = {
    return_changes: {
      accent: "var(--yellow-500)", eyebrowCls: "eyebrow--yellow",
      heading: t("discovery.steward.returnHeading"),
      items: review.required_changes || [], marker: "→", markerColor: "var(--orange-600)",
      cta: t("discovery.steward.returnCta"),
    },
    reject: {
      accent: "var(--pink-500)", eyebrowCls: "eyebrow--pink",
      heading: t("discovery.steward.rejectHeading"),
      items: [], marker: null, markerColor: null,
      cta: t("discovery.steward.rejectCta"),
    },
    approve_with_conditions: {
      accent: "var(--green-500)", eyebrowCls: "eyebrow--green",
      heading: t("discovery.steward.conditionsHeading"),
      items: review.conditions || [], marker: "✓", markerColor: "var(--green-600)",
      cta: null,
    },
  }[decision];

  const reason = decision === "reject" ? humanizeReasonCode(review.reject_reason_code) : "";
  const hasBody = !!reason || cfg.items.length > 0 || !!notes;

  return (
    <div className="card" style={{padding:"14px 16px", marginBottom: 18, borderLeft:`3px solid ${cfg.accent}`}}>
      <div className={"eyebrow " + cfg.eyebrowCls} style={{marginBottom: 6}}>{t("discovery.steward.fromSteward")}</div>
      <div style={{fontSize: 14.5, fontWeight: 600, color:"var(--c-ink)", marginBottom: 4}}>{cfg.heading}</div>
      <div style={{fontSize: 12, color:"var(--c-faint)", marginBottom: hasBody ? 10 : (cfg.cta ? 12 : 0)}}>
        {by}{when ? ` · ${when}` : ""}
      </div>

      {reason && (
        <div style={{marginBottom: (cfg.items.length || notes) ? 10 : (cfg.cta ? 12 : 0)}}>
          <span className="pill" style={{color:"var(--pink-500)", fontSize: 11.5}}>{reason}</span>
        </div>
      )}

      {cfg.items.length > 0 && (
        <ul style={{margin:"0 0 " + (notes || cfg.cta ? "10px" : "0"), padding: 0, listStyle:"none", display:"flex", flexDirection:"column", gap: 7}}>
          {cfg.items.map((it, i) => (
            <li key={i} style={{display:"flex", gap: 8, alignItems:"flex-start", fontSize: 13, color:"var(--c-ink)", lineHeight: 1.5}}>
              {cfg.marker && <span style={{color: cfg.markerColor}}>{cfg.marker}</span>}
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}

      {notes && (
        <div style={{fontSize: 12.5, color:"var(--c-dim)", lineHeight: 1.5, fontStyle:"italic", borderLeft:`2px solid ${cfg.accent}`, paddingLeft: 10, marginBottom: cfg.cta ? 12 : 0}}>
          “{notes}” <span style={{fontStyle:"normal", color:"var(--c-faint)"}}>— {by}</span>
        </div>
      )}

      {cfg.cta && (
        <button className="btn btn--primary btn--sm" onClick={onEdit}>
          <Icon name="edit" size={14} /> {cfg.cta}
        </button>
      )}
    </div>
  );
}

/* StewardDiffPanel — collapsible "What your Steward changed". Lists each edit
   the Steward made vs. the prior version as before → after (muted/struck
   "before", emphasized "after"). Hidden when the Steward changed nothing. */
function StewardDiffPanel({ diff }) {
  const { t } = useLocale();
  const [open, setOpen] = useDState(false);
  if (!Array.isArray(diff) || diff.length === 0) return null;
  return (
    <div className="card" style={{padding:"12px 16px", marginBottom: 18, borderLeft:"3px solid var(--green-500)"}}>
      <button onClick={() => setOpen((o) => !o)}
        style={{display:"flex", alignItems:"center", gap: 8, width:"100%", background:"transparent", border:"none", cursor:"pointer", padding: 0, textAlign:"left"}}>
        <Icon name="check" size={14} />
        <span style={{fontSize: 13.5, fontWeight: 500, color:"var(--c-ink)"}}>
          {t("discovery.diff.title", { count: diff.length })}
        </span>
        <span style={{marginLeft:"auto", fontFamily:"var(--font-mono)", fontSize: 11, color:"var(--c-faint)"}}>{open ? t("discovery.diff.hide") : t("discovery.diff.show")}</span>
      </button>
      {open && (
        <div style={{marginTop: 12, display:"flex", flexDirection:"column", gap: 10}}>
          {diff.map((d, i) => (
            <div key={i} style={{display:"grid", gridTemplateColumns:"140px 1fr", gap: 12, alignItems:"start", paddingBottom: i < diff.length - 1 ? 10 : 0, borderBottom: i < diff.length - 1 ? "1px solid var(--c-line)" : "none"}}>
              <div style={{fontFamily:"var(--font-mono)", fontSize: 11, color:"var(--c-faint)", letterSpacing:"0.04em", textTransform:"uppercase"}}>{d.label || d.field}</div>
              <div style={{fontSize: 13, lineHeight: 1.55}}>
                <span style={{color:"var(--c-faint)", textDecoration:"line-through"}}>{diffText(d.before)}</span>
                <span style={{color:"var(--c-faint)", margin:"0 6px"}}>→</span>
                <span style={{color:"var(--c-ink)", fontWeight: 500}}>{diffText(d.after)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* BIO viewer field labels double as round-trip lookup keys in
   payloadToFields/fieldsToPayload, so the stored label stays English; this map
   translates it for DISPLAY only. Labels not in the map (user-added fields)
   render as-is. */
const BIO_FIELD_LABEL_KEYS = {
  "Positioning": "positioning", "Category": "category", "Founded": "founded", "Pillars": "pillars",
  "Primary": "primary", "Secondary": "secondary", "Tertiary": "tertiary", "Jobs to be done": "jtbd",
  "Register": "register", "Forbidden": "forbidden", "Rhythm": "rhythm", "Signatures": "signatures",
  "North star": "northStar", "This quarter": "thisQuarter", "Next quarter": "nextQuarter",
};
const bioFieldLabel = (label) => {
  const key = BIO_FIELD_LABEL_KEYS[label];
  return key ? tr("discovery.bioField." + key) : label;
};

/* BIO surface lock. Kept local to this route so the document can retain its
   editorial score treatment and remain usable on narrow screens without
   changing the shared portal stylesheet. */
const BIO_SURFACE_CSS = `
  .cos-bio .bio-hero { grid-template-columns: minmax(0, 1fr) 320px; }
  .cos-bio .bio-score { font-family: Georgia, serif !important; font-style: italic !important; font-weight: 500 !important; }
  .cos-bio .bio-tabs { overflow-x: auto; scrollbar-width: thin; }
  .cos-bio .bio-tabs .tab { white-space: nowrap; }
  .cos-bio .bio-field-header, .cos-bio .bio-field-row { grid-template-columns: 180px minmax(0, 1fr) 110px; }
  @media (max-width: 720px) {
    .cos-bio .bio-hero { grid-template-columns: 1fr; gap: 18px; align-items: start; }
    .cos-bio .bio-hero-actions { align-items: flex-start !important; flex-direction: row !important; flex-wrap: wrap; }
    .cos-bio .bio-field-header { display: none !important; }
    .cos-bio .bio-field-row { grid-template-columns: 1fr 86px !important; gap: 10px !important; }
    .cos-bio .bio-field-row > :first-child { grid-column: 1 / -1; }
  }
`;

function BioViewer({ go, bioScore = 91 }) {
  const { t } = useLocale();
  const [tab, setTab] = useDState(uiFixtureEnabled ? "strategic" : "identity");
  const [feed, setFeed] = useDState("");
  const [reading, setReading] = useDState(false);
  const [toast, setToast] = useDState(null);
  const [editing, setEditing] = useDState(false);
  const [saving, setSaving] = useDState(false);
  const [saveErr, setSaveErr] = useDState(null);
  const [reviewBusy, setReviewBusy] = useDState(false);
  const [hasUnappliedSourceChanges, setHasUnappliedSourceChanges] = useDState(false);

  /* Live cert state + payload — polls /api/bios/:brandId. The BIO body
     below renders from `live.bio.payload`; the cert chip from `live.cert`. */
  const live = useLiveBio({ pollMs: 5000 });

  /* Local editable view; hydrated from the live payload each time the
     server's BIO changes (version bump). Discards in-flight edits when
     a new server version arrives — that's the right behavior because the
     server version is the truth and our edits are based off the prior. */
  const [bio, setBio] = useDState(null);
  const [sources, setSources] = useDState([]);

  useDEffect(() => {
    setBio(live.bio?.payload ? payloadToFields(live.bio.payload) : null);
    setEditing(false);
    setSaveErr(null);
    setHasUnappliedSourceChanges(false);
  }, [live.brandId, live.bio?.id]);

  useDEffect(() => {
    if (uiFixtureEnabled) { setSources(FIXTURE_SOURCES); return undefined; }
    setSources([]);
    if (!live.brandId) return undefined;
    let alive = true;
    supabase.from("bio_sources").select("id, kind, bucket, src, signals, raw_ref, created_at")
      .eq("brand_id", live.brandId).order("created_at", { ascending: false })
      .then(({ data }) => { if (alive && data) setSources(data.map(s => ({ src: s.src, date: new Date(s.created_at).toLocaleDateString(undefined,{day:"numeric",month:"short"}), n: s.signals?.markdown_chars ? Math.round(s.signals.markdown_chars / 200) : 6, bucket: s.bucket, raw_ref: s.raw_ref, brandEvidence: s.signals?.counts_as_brand_evidence !== false && s.signals?.evidence !== "competitor" && s.signals?.evidence !== "market" && s.signals?.purpose !== "competitive" }))); });
    return () => { alive = false; };
  }, [live.brandId, live.bio?.id]);

  const score = live.bio?.payload ? scoreBio(live.bio.payload) : 0;
  const foundation = foundationStatus(live.bio?.payload);
  const patch = (key, value) => setBio(b => b ? { ...b, [key]: value } : b);
  const patchStrategic = (key, value) => setBio(b => b ? { ...b, strategic: { ...b.strategic, [key]: value } } : b);

  const saveBio = async () => {
    if (!bio || !live.brandId) return;
    setSaving(true); setSaveErr(null);
    try {
      const payload = fieldsToPayload(bio, live.bio?.payload);
      const res = await apiFetch(`/api/bios/${live.brandId}`, {
        method: "PATCH",
        body: JSON.stringify({ payload, score }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      flash(t("discovery.bio.savedVersion", { version: json.bio?.version }));
      setEditing(false);
      live.refresh();
    } catch (e) {
      setSaveErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const flash = (msg) => { setToast(msg); clearTimeout(window.__bioT); window.__bioT = setTimeout(() => setToast(null), 2800); };

  /* Client-initiated human review of the CURRENT BIO — no edit required.
     Enqueues a Steward job server-side (idempotent). */
  const requestReview = async () => {
    if (!live.brandId || reviewBusy) return;
    if (hasUnappliedSourceChanges) {
      flash("Update the Brand Core with pending evidence before requesting review");
      return;
    }
    setReviewBusy(true);
    try {
      const res = await apiFetch(`/api/bios/${live.brandId}/request-review`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      flash(json.reused ? t("discovery.bio.reviewInProgress") : t("discovery.bio.sentForReview"));
      live.refresh();
    } catch (e) {
      flash(t("discovery.bio.couldntRequestReview", { error: e?.message || e }));
    } finally {
      setReviewBusy(false);
    }
  };

  const addReference = async (labelArg, kind) => {
    const ref = (labelArg ?? feed).trim();
    if (!ref || reading || !live.brandId) return;
    setReading(true); setFeed("");
    publishReadProgress({ done: sources.length, total: Math.max(sources.length + 1, 1) });
    try {
      const res = await apiFetch(`/api/bios/${live.brandId}/sources`, {
        method: "POST",
        body: JSON.stringify({ sources: [{ kind: kind || "url_reference", bucket: null, src: ref }] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      /* Optimistic prepend so user sees it immediately; the next poll
         will hydrate the real signals/markdown_chars. */
      setSources(s => [{ src: ref, date: t("discovery.sources.justNow"), n: 0, fresh: true }, ...s]);
      setHasUnappliedSourceChanges(true);
      flash(t("discovery.bio.added", { ref: ref.slice(0, 40) }));
    } catch (e) {
      flash(t("discovery.bio.couldntAdd", { error: e?.message || e }));
    } finally {
      setReading(false);
      publishReadProgress(uiFixtureEnabled ? { done: 3, total: 7 } : null);
    }
  };

  const tabs = ["identity", "audience", "competitive", "voice", "visual", "goals", "strategic", "sources"];

  const conf = score;
  const tone = conf >= 85
    ? { color:"var(--green-600)", word:t("discovery.bioTone.well.word"), hint:t("discovery.bioTone.well.hint") }
    : conf >= 65
    ? { color:"var(--orange-600)", word:t("discovery.bioTone.filling.word"), hint:t("discovery.bioTone.filling.hint") }
    : { color:"var(--pink-500)", word:t("discovery.bioTone.needs.word"), hint:t("discovery.bioTone.needs.hint") };

  if(live.error)return <div className="cos-page cos-bio bio-viewer" style={{padding:"32px 36px"}}><h1 style={{fontFamily:"var(--font-serif)"}}>{live.brandName || t("discovery.results.yourBrand")}</h1><div className="card" role="alert" style={{padding:24}}><h2>{t("discovery.integrity.unavailable")}</h2><p>{live.error}</p><p>{t("discovery.integrity.preserved")}</p><button className="btn btn--ghost" onClick={live.refresh}>{t("discovery.integrity.retry")}</button></div></div>;

  return (
    <div className="cos-page cos-bio bio-viewer" style={{padding:"24px 36px 60px"}}>
      <style>{BIO_SURFACE_CSS}</style>
      {/* Hero */}
      <div className="bio-hero page-header" style={{marginBottom: 28}}>
        <div>
          <div className="eyebrow" style={{marginBottom: 6}}>{t("discovery.bio.eyebrow")}</div>
          <h1 className="brand-title" style={{margin: "0 0 8px"}}>{live.brandName || "Brand Core"}</h1>
          <div style={{display:"flex", alignItems:"center", gap: 8, fontSize: 13, color:"var(--c-dim)"}}>
            <span className="dot-state" style={{background: tone.color}} />
            <span>{tone.word}</span>
            <span style={{color:"var(--c-faint)"}}>·</span>
            <span className="num" title={tone.hint}><Counter to={conf} /> {t("discovery.bio.of100")}</span>
            {live.cert && foundation.certifiable ? (
              <>
                <span className="cert-seal" aria-hidden="true">
                  <Icon name="check" size={10} stroke={2} />
                </span>
                <span>{t("discovery.bio.certifiedDate", { date: formatCertDate(live.cert.at) })}</span>
              </>
            ) : live.bio ? (
              <span className="num" title={t("discovery.bio.versionTitle", { version: live.bio.version })}>{t("discovery.bio.uncertified")} · v{live.bio.version}</span>
            ) : null}
          </div>
        </div>
        <div className="page-actions">
          {editing ? (
            <>
              <button className="btn btn--primary" disabled={saving || !bio} onClick={saveBio}>
                {saving ? t("discovery.bio.savingChanges") : t("discovery.bio.saveChanges")}
              </button>
              <button className="btn btn--ghost" disabled={saving}
                onClick={() => { setEditing(false); if (live.bio?.payload) setBio(payloadToFields(live.bio.payload)); setSaveErr(null); }}>
                {t("discovery.common.cancel")}
              </button>
            </>
          ) : (
            <>
              {live.brandId && live.bio && (!live.cert || (live.bio.client_acceptance_required && !live.bio.client_accepted_at)) && (
                <BioSelfCertification brandId={live.brandId} brandName={live.brandName} bio={live.bio} blocked={editing || hasUnappliedSourceChanges || !foundation.certifiable} onDone={live.refresh} renderSection={section => <BioReviewSection payload={live.bio.payload} section={section} />} />
              )}
              <button className="btn btn--ghost" onClick={() => go("brand-book")}>{t("discovery.bio.openBook")}</button>
            </>
          )}
          <window.OverflowMenu items={[
            { label: t("discovery.bio.editProfile"), disabled: editing || !bio, onClick: () => {setBio(current=>({...current,palette:suggestColourRoles(current.palette || [])}));setEditing(true);} },
            { label: t("discovery.bio.rerunDiscovery"), onClick: () => go("discovery") },
            { label: live.reviewPending ? t("discovery.bio.inReviewShort") : t("discovery.bio.requestHumanReview"), disabled: !live.bio || reviewBusy || live.reviewPending || hasUnappliedSourceChanges, onClick: requestReview },
            { label: t("discovery.bio.addSources"), disabled: !live.brandId, onClick: () => setTab("sources") },
          ]} />
        </div>
      </div>

      {live.bio?.payload && <FoundationStrip key={live.brandId} brandId={live.brandId} payload={live.bio.payload} disabled={editing || saving} onSave={async visual=>{
        const payload={...live.bio.payload,visual};
        if(uiFixtureEnabled){saveFixtureFoundation(payload);return;}
        const res=await apiFetch(`/api/bios/${live.brandId}`,{method:'PATCH',body:JSON.stringify({payload})});
        const json=await res.json();if(!res.ok)throw Error(json.error || 'Foundation save failed');
        await live.refresh();
      }}/>}

      {/* Live cert chip — pulls real DB state, polls every 5s */}
      {live.brandId && (
        <div className="card" style={{
          padding:"10px 14px", marginBottom: 18,
          display:"flex", alignItems:"center", justifyContent:"space-between", gap: 12,
        }}>
          <div style={{display:"flex", alignItems:"center", gap: 10}}>
            {live.cert && foundation.certifiable && (
              <span className="cert-seal" title="Certified" aria-hidden="true">
                <Icon name="check" size={10} stroke={2} />
              </span>
            )}
            <span style={{
              width: 8, height: 8, borderRadius:"50%",
              background: live.cert && foundation.certifiable ? "var(--status-success)" : "var(--status-warning)",
              animation: live.cert ? "none" : "pulse 1.4s ease-in-out infinite",
            }} />
            <div>
              <div style={{fontSize: 13.5, color:"var(--c-ink)", fontWeight: 500}}>
                {live.cert && foundation.certifiable ? (
                  <>{t("discovery.results.certifiedBy")} <span style={{color:"var(--green-600)"}}>{live.cert.byName}</span> · {formatCertDate(live.cert.at)}</>
                ) : live.reviewPending && live.bio ? (
                  <>{t("discovery.bio.reviewingThis")}</>
                ) : live.bio ? (
                  <>{t("discovery.bio.awaitingCert")}</>
                ) : (
                  <>{t("discovery.bio.noBioYet")}</>
                )}
              </div>
              {live.bio && (
                <div style={{fontSize: 12, color:"var(--c-faint)", marginTop: 2}}>
                  {live.brandName} · {t("discovery.bio.versionScore", { version: live.bio.version, score: live.bio.score ?? "—" })}
                </div>
              )}
              {!live.cert && live.focusCount > 0 && (
                <div style={{fontSize: 12, color:"var(--c-dim)", marginTop: 6, lineHeight: 1.5}}>
                  {t("discovery.bio.flaggedAreas", { count: live.focusCount })}
                </div>
              )}
              {live.cert?.notes && (
                <div style={{fontSize: 12.5, color:"var(--c-dim)", marginTop: 6, lineHeight: 1.5, fontStyle:"italic", borderLeft:"2px solid var(--green-300, rgba(127,163,122,0.4))", paddingLeft: 10}}>
                  “{live.cert.notes}” <span style={{fontStyle:"normal", color:"var(--c-faint)"}}>— {live.cert.byName}</span>
                </div>
              )}
            </div>
          </div>
          {!live.cert && live.bio && (
            <span style={{fontSize: 11.5, color:"var(--c-dim)", fontStyle:"italic", whiteSpace:"nowrap"}}>
              {live.reviewPending ? t("discovery.bio.inReview") : t("discovery.bio.within24h")}
            </span>
          )}
        </div>
      )}

      {/* From your Steward — change requests / returned BIO / conditions.
          CTA drops the BIO into the existing edit flow (Save → re-certify). */}
      {live.brandId && <StewardReviewPanel review={live.review} onEdit={() => setEditing(true)} />}

      {/* What your Steward changed — before → after diff of the Steward's edits */}
      {live.brandId && <StewardDiffPanel diff={live.diff} />}


      {editing && (
        <div className="card" style={{padding:"10px 16px", marginBottom:14, borderLeft:"3px solid var(--brand, var(--yellow-500))", display:"flex", alignItems:"center", gap:10}}>
          <Icon name="edit" size={15} />
          <span style={{fontSize:13, color:"var(--c-ink)"}}>{t("discovery.bio.editingBanner")}</span>
        </div>
      )}
      {hasUnappliedSourceChanges && (
        <div className="card" style={{padding:"10px 14px", marginBottom:14, borderLeft:"3px solid var(--yellow-500)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12}}>
          <span style={{fontSize:13}}>Review the changes before requesting certification.</span>
          <button className="btn btn--ghost" onClick={() => go("discovery")}>Update Brand Core</button>
        </div>
      )}
      {saveErr && (
        <div className="card" style={{padding:"10px 14px", marginBottom: 14, borderLeft:"3px solid var(--pink-500)", color:"var(--c-ink)", fontSize: 13}}>{saveErr}</div>
      )}

      {live.error && <div className="card" role="alert" style={{padding:24,marginBottom:20}}><strong>{live.brandName || "Selected brand"}</strong><p>{live.error}</p></div>}
      {/* Empty state — no BIO extracted yet */}
      {!live.loading && !live.bio && live.brandId && (
        <div className="card" style={{padding:"56px 32px", textAlign:"center", maxWidth: 580, margin:"40px auto"}}>
          <h2 style={{
            margin:"0 0 14px", fontFamily:"Georgia, serif", fontStyle:"italic",
            fontSize: 28, lineHeight: 1.2, letterSpacing:"-0.005em", fontWeight: 400, color:"var(--c-ink)",
          }}>
            {t("discovery.bio.noCanon")}
          </h2>
          <p style={{margin:"0 0 22px", fontSize: 14, color:"var(--c-dim)", lineHeight: 1.6}}>
            {t("discovery.bio.noCanonDesc")}
          </p>
          <div style={{display:"flex", gap: 10, justifyContent:"center"}}>
            <button className="btn btn--primary" onClick={() => go("discovery")}>
              <Icon name="sparkles" size={13} /> {t("discovery.bio.startDiscovery")}
            </button>
          </div>
        </div>
      )}

      {/* Tabs — only when we have a BIO */}
      {bio && live.bio && (
        <div className="card" style={{padding: 0, overflow:"hidden"}}>
          <div className="tabs bio-tabs">
            {tabs.map((k) => (
              <button key={k} className={"tab" + (tab === k ? " tab--active" : "")} onClick={() => setTab(k)}>{t("discovery.tab." + k)}</button>
            ))}
          </div>
          <div style={{padding: 28}}>
            <SectionTour key={tab} scope={`bio-section-${tab}`} steps={[
              {title:t("discovery.tab."+tab),text:t(tab==="sources"?"discovery.tour.sourceText":"discovery.tour.viewerText")},
              {title:t("discovery.tour.confirmTitle"),text:t("discovery.tour.confirmText")},
            ]}/>
            {["identity","audience","voice","goals"].includes(tab) && (
              <div className="bio-field-header" style={{display:"grid", gridTemplateColumns:"180px 1fr 110px", gap:18, paddingBottom:10, marginBottom:2, borderBottom:"1px solid var(--c-line)", alignItems:"baseline"}}>
                <div className="eyebrow" style={{margin:0}}>{t("discovery.table.field")}</div>
                <div className="eyebrow" style={{margin:0}}>{t("discovery.table.whatWeKnow")}</div>
                <div style={{textAlign:"right"}}>
                  <div className="eyebrow" style={{margin:0}} title={t("discovery.table.confidenceTitle")}>{t("discovery.table.confidence")}</div>
                  <div style={{fontFamily:"var(--font-mono)", fontSize:9.5, color:"var(--c-faint)", letterSpacing:"0.04em", textTransform:"uppercase", marginTop:3}}>{t("discovery.table.lowHigh")}</div>
                </div>
              </div>
            )}
            {tab === "identity"    && <BioFieldList items={bio.identity}    editing={editing} onChange={v => patch("identity", v)} />}
            {tab === "audience"    && <BioFieldList items={bio.audience}    editing={editing} onChange={v => patch("audience", v)} />}
            {tab === "competitive" && <BioCompetitive aspirations={live.bio?.payload?.aspirations} value={bio.positioning} editing={editing} onChange={value=>patch("positioning",value)} />}
            {tab === "voice"       && <BioFieldList items={bio.voice}       editing={editing} onChange={v => patch("voice", v)} />}
            {tab === "visual"      && <BioVisual bio={bio} patch={patch} editing={editing} brandId={live.brandId} />}
            {tab === "goals"       && <BioFieldList items={bio.goals}       editing={editing} onChange={v => patch("goals", v)} />}
            {tab === "strategic"   && <BioStrategic strat={bio.strategic} patchStrategic={patchStrategic} editing={editing} />}
            {tab === "sources"     && <BioSources brandId={live.brandId} sources={sources} setSources={setSources} feed={feed} setFeed={setFeed} reading={reading} addReference={addReference} onSourceAdded={() => setHasUnappliedSourceChanges(true)} editing={editing} go={go} />}
          </div>
        </div>
      )}

      {/* Learning toast */}
      {toast && (
        <div style={{position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", zIndex:60, background:"var(--c-inverse)", color:"#fff", borderRadius:10, padding:"11px 18px", fontSize:13.5, boxShadow:"var(--shadow-lg)", display:"flex", alignItems:"center", gap:9, maxWidth:560, animation:"cvPopIn 200ms ease"}}>
          <BrandolphDot /> {toast}
        </div>
      )}
    </div>
  );
}

/* ---- Editing primitives ----------------------------------------- */
const EDIT_INPUT = { width:"100%", border:"1px solid var(--c-line-2)", borderRadius:7, background:"var(--c-bg)", padding:"7px 10px", fontSize:13.5, color:"var(--c-ink)", outline:"none", fontFamily:"inherit", boxSizing:"border-box" };
const CHIP_X = { border:"none", background:"transparent", cursor:"pointer", color:"var(--c-faint)", fontSize:14, lineHeight:1, padding:"0 2px" };

function EditInput({ value, onChange, placeholder, mono, area }) {
  const st = { ...EDIT_INPUT, ...(mono ? { fontFamily:"var(--font-mono)", fontSize:11.5 } : {}), ...(area ? { resize:"vertical", minHeight:60, lineHeight:1.5 } : { height:34 }) };
  return area
    ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} style={st} />
    : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={st} />;
}

function ChipEditor({ items, onChange }) {
  const { t } = useLocale();
  const set = (i, v) => onChange(items.map((x, j) => j === i ? v : x));
  return (
    <div style={{display:"flex", flexWrap:"wrap", gap:6, alignItems:"center"}}>
      {items.map((v, i) => (
        <span key={i} className="pill" style={{paddingRight:4, gap:2}}>
          <input value={v} onChange={(e) => set(i, e.target.value)} style={{border:"none", background:"transparent", outline:"none", font:"inherit", color:"inherit", width: Math.max(36, (v.length || 4) * 7) + "px"}} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={CHIP_X} title={t("discovery.common.remove")}>×</button>
        </span>
      ))}
      <button className="pill" onClick={() => onChange([...items, ""])} style={{borderStyle:"dashed", cursor:"pointer", color:"var(--c-dim)"}}>{t("discovery.editPrimitive.chipAdd")}</button>
    </div>
  );
}

function StringListEditor({ items, onChange, marker, color }) {
  const { t } = useLocale();
  const set = (i, v) => onChange(items.map((x, j) => j === i ? v : x));
  return (
    <ul style={{margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:8}}>
      {items.map((x, i) => (
        <li key={i} style={{display:"flex", gap:8, alignItems:"flex-start"}}>
          {marker && <span style={{color, lineHeight:"34px"}}>{marker}</span>}
          <div style={{flex:1}}><EditInput value={x} onChange={(v) => set(i, v)} /></div>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={{...CHIP_X, lineHeight:"34px"}} title={t("discovery.common.remove")}>×</button>
        </li>
      ))}
      <li><button className="btn btn--ghost btn--sm" onClick={() => onChange([...items, ""])}><Icon name="plus" size={12} /> {t("discovery.editPrimitive.addItem")}</button></li>
    </ul>
  );
}

function EditableField({ f, editing, onChange, onRemove }) {
  const { t } = useLocale();
  if (!editing) {
    return (
      <div className="bio-field-row" style={{display:"grid", gridTemplateColumns: "180px 1fr 110px", gap: 18, padding:"14px 0", borderBottom:"1px solid var(--c-line)", alignItems:"start"}}>
        <div>
          <div style={{fontFamily:"var(--font-mono)", fontSize:11, color:"var(--c-faint)", letterSpacing:"0.06em", textTransform:"uppercase"}}>{bioFieldLabel(f.label)}</div>
          {f.source && <div style={{fontSize: 11, color:"var(--c-faint)", marginTop: 4, fontStyle:"italic"}}>{t("discovery.field.from", { source: f.source === "steward edit" ? "Creative Director" : f.source })}</div>}
        </div>
        <div style={{fontSize: 14, color:"var(--c-ink)", lineHeight: 1.55}}>
          {f.multi
            ? (["jtbd","signatures"].includes(f.key)?<ul style={{paddingInlineStart:18,margin:0}}>{(f.value||[]).map((v,i)=><li key={i} style={{marginBottom:8}}>{v}</li>)}</ul>:<div style={{display:"flex", flexWrap:"wrap", gap: 6}}>{(f.value || []).map((v, i) => <span key={i} className="pill">{v}</span>)}</div>)
            : (f.value==null||f.value===""?<span style={{color:"var(--c-dim)"}}>{t("discovery.certification.missing")}</span>:f.italic ? <em style={{fontStyle:"italic"}}>{f.value}</em> : f.value)}
        </div>
        <div style={{textAlign:"right"}}>{typeof f.conf==='number'&&<Confidence value={f.conf} />}</div>
      </div>
    );
  }
  return (
    <div className="bio-field-row" style={{display:"grid", gridTemplateColumns: "180px 1fr 110px", gap: 18, padding:"14px 0", borderBottom:"1px solid var(--c-line)", alignItems:"start"}}>
      <div style={{display:"flex", flexDirection:"column", gap:6}}>
        <EditInput value={f.label} onChange={(v) => onChange({ label: v })} placeholder={t("discovery.editPrimitive.labelPlaceholder")} mono />
        <EditInput value={f.source || ""} onChange={(v) => onChange({ source: v })} placeholder={t("discovery.editPrimitive.sourcePlaceholder")} />
      </div>
      <div>
        {f.multi
          ? <ChipEditor items={f.value || []} onChange={(v) => onChange({ value: v })} />
          : <EditInput area value={f.value} onChange={(v) => onChange({ value: v })} placeholder={t("discovery.editPrimitive.valuePlaceholder")} />}
      </div>
      <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8}}>
        <div style={{display:"flex", alignItems:"center", gap:4}}>
          <input type="number" min={0} max={100} value={f.conf} onChange={(e) => onChange({ conf: Math.max(0, Math.min(100, +e.target.value || 0)) })} style={{...EDIT_INPUT, width:56, height:30, textAlign:"right", fontFamily:"var(--font-mono)", fontSize:12}} />
          <span style={{fontSize:11, color:"var(--c-faint)"}}>%</span>
        </div>
        <button className="btn btn--link" style={{fontSize:11, color:"var(--pink-500)"}} onClick={onRemove}>{t("discovery.editPrimitive.removeField")}</button>
      </div>
    </div>
  );
}

function BioFieldList({ items, editing, onChange }) {
  const { t } = useLocale();
  const upd = (i, p) => onChange(items.map((x, j) => j === i ? { ...x, ...p } : x));
  const rm = (i) => onChange(items.filter((_, j) => j !== i));
  const add = (multi) => onChange([...items, { key: `custom_${Date.now().toString(36)}`, label: "New field", value: multi ? [] : "", conf: 50, source: "manual entry", multi }]);
  return (
    <div>
      {items.map((f, i) => <EditableField key={f.key || i} f={f} editing={editing} onChange={(p) => upd(i, p)} onRemove={() => rm(i)} />)}
      {editing && (
        <div style={{display:"flex", gap:8, marginTop:14}}>
          <button className="btn btn--ghost btn--sm" onClick={() => add(false)}><Icon name="plus" size={13} /> {t("discovery.editPrimitive.addField")}</button>
          <button className="btn btn--ghost btn--sm" onClick={() => add(true)}><Icon name="plus" size={13} /> {t("discovery.editPrimitive.addListField")}</button>
        </div>
      )}
    </div>
  );
}
function BioSectionHead({ label, source, conf }) {
  const { t } = useLocale();
  return (
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:14}}>
      <div>
        <div style={{fontFamily:"var(--font-mono)", fontSize:11, color:"var(--c-faint)", letterSpacing:"0.08em", textTransform:"uppercase"}}>{label}</div>
        {source && <div style={{fontSize:11, color:"var(--c-faint)", marginTop:3, fontStyle:"italic"}}>{t("discovery.field.from", { source })}</div>}
      </div>
      {conf != null && <Confidence value={conf} />}
    </div>
  );
}

function BioVisual({ bio, patch, editing, brandId }) {
  const brandFonts=useBrandFonts(bio.type || [],brandId);
  const [loadedFonts, setLoadedFonts] = useDState({});
  const [fontFailures, setFontFailures] = useDState({});
  useDEffect(() => {
    let alive = true;
    const sourced = (bio.type || []).filter((font) => font.sourceId && font.family);
    setLoadedFonts({});
    setFontFailures({});
    Promise.all(sourced.map(async (font) => {
      try {
        const response = await apiFetch(`/api/bios/${brandId}/sources/${font.sourceId}/url`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const { url } = await response.json();
        const cssFamily = `CaastorAsset-${font.sourceId}`;
        const face = new FontFace(cssFamily, `url(${url})`);
        await face.load();
        document.fonts.add(face);
        return { sourceId:font.sourceId, cssFamily };
      } catch { return { sourceId:font.sourceId, failed:true }; }
    })).then((entries) => {
      if (!alive) return;
      setLoadedFonts(Object.fromEntries(entries.filter((entry) => entry.cssFamily).map((entry) => [entry.sourceId, entry.cssFamily])));
      setFontFailures(Object.fromEntries(entries.filter((entry) => entry.failed).map((entry) => [entry.sourceId, true])));
    });
    return () => { alive = false; };
  }, [brandId, JSON.stringify((bio.type || []).map((font) => [font.sourceId, font.family]))]);
  const { t, locale } = useLocale();
  const typeSample = locale === "ar"
    ? "أبجد هوز حطي كلمن · ٠١٢٣٤٥٦٧٨٩"
    : locale === "es" ? "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ · áéíóú · 0123456789" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ · 0123456789";
  const typeHero = locale === "ar" ? "أب جد" : "Aa Gg";
  const dark = (hex) => {
    const n = parseInt((hex || "#000").slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
  };
  const updPal = (i, p) => patch("palette", bio.palette.map((x, j) => j === i ? { ...x, ...p } : x));
  const updType = (i, p) => patch("type", bio.type.map((x, j) => j === i ? { ...x, ...p } : x));
  return (
    <div style={{display:"flex", flexDirection:"column", gap:30}}>
      {/* PALETTE */}
      <section>
        <BioSectionHead label={t("discovery.visual.paletteHead")} source="visual extraction" />
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:12}}>
          {bio.palette.map((c, i) => (
            <div key={i} className="card" style={{padding:0, overflow:"hidden"}}>
              <div style={{height:92, background:c.hex, display:"flex", alignItems:"flex-end", justifyContent:"space-between", padding:10}}>
                {editing
                  ? <input type="color" value={c.hex} onChange={(e) => updPal(i, { hex: e.target.value })} style={{width:30, height:24, border:"none", background:"transparent", cursor:"pointer", padding:0}} />
                  : <span style={{fontFamily:"var(--font-mono)", fontSize:10.5, color: dark(c.hex) ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.6)", letterSpacing:"0.04em"}}>{c.hex}</span>}
                {editing && <button onClick={() => patch("palette", bio.palette.filter((_, j) => j !== i))} style={{...CHIP_X, color: dark(c.hex) ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.6)", fontSize:16}} title={t("discovery.visual.removeColour")}>×</button>}
              </div>
              <div style={{padding:"10px 12px"}}>
                {editing
                  ? <div style={{display:"flex", flexDirection:"column", gap:6}}>
                      <select aria-label="Colour role" value={c.role || ""} onChange={e=>patch("palette",bio.palette.map((item,j)=>j===i?{...item,role:e.target.value,roleStatus:"confirmed"}:item.role===e.target.value&&["primary","ink","surface"].includes(e.target.value)?{...item,role:"accent"}:item))}><option value="">Unclassified</option>{["primary","ink","surface","accent"].map(role=><option key={role}>{role}</option>)}</select>
                      <EditInput value={c.name} onChange={(v) => updPal(i, { name: v })} placeholder={t("discovery.visual.namePlaceholder")} />
                      <div style={{display:"flex", gap:6}}>
                        <EditInput value={c.wcag} onChange={(v) => updPal(i, { wcag: v })} placeholder={t("discovery.visual.wcagPlaceholder")} mono />
                        <input type="number" min={0} max={100} value={c.conf} onChange={(e) => updPal(i, { conf: +e.target.value || 0 })} style={{...EDIT_INPUT, width:60, height:34, fontFamily:"var(--font-mono)", fontSize:11.5}} />
                      </div>
                    </div>
                  : <>
                      <div style={{fontSize:13.5, fontWeight:600, color:"var(--c-ink)"}}>{c.name}</div>
                      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8}}>
                        <span className="pill" style={{height:18, padding:"0 8px", fontSize:9.5}}>{c.wcag?t("discovery.visual.wcag", { value: c.wcag }):t("discovery.visual.role."+(c.role||"unclassified"))}</span>
                        <span style={{fontFamily:"var(--font-mono)", fontSize:10, color: c.conf >= 85 ? "var(--green-600)" : c.conf >= 65 ? "var(--orange-600)" : "var(--pink-500)"}}>{typeof c.conf==='number'?`${c.conf}%`:t("discovery.certification.verify")}</span>
                      </div>
                    </>}
              </div>
            </div>
          ))}
          {editing && (
            <button className="card" onClick={() => patch("palette", [...bio.palette, { hex:"#888888", name:"New colour", conf:50, wcag:"—" }])}
              style={{display:"flex", alignItems:"center", justifyContent:"center", minHeight:150, borderStyle:"dashed", cursor:"pointer", color:"var(--c-dim)", gap:6}}>
              <Icon name="plus" size={16} /> {t("discovery.common.addColour")}
            </button>
          )}
        </div>
      </section>

      {/* TYPOGRAPHY */}
      <section>
        <BioSectionHead label={t("discovery.visual.typographyHead")} source={t("discovery.visual.typographySource")} />
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
          {bio.type.map((tf, i) => {
            const serif = /sectra|serif|display/i.test(tf.family) && tf.kind === "Body";
            const brandFamily=brandFonts[tf.sourceId || tf.family]?.family;
            const ff = brandFamily ? `"${brandFamily}"` : loadedFonts[tf.sourceId]
              ? `'${loadedFonts[tf.sourceId]}', var(--font-sans)`
              : serif ? "Georgia, 'Times New Roman', serif" : "var(--font-sans)";
            return (
              <div key={i} className="card" style={{padding:18}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
                  {editing
                    ? <input value={tf.kind} onChange={(e) => updType(i, { kind: e.target.value })} style={{...EDIT_INPUT, width:130, height:28}} />
                    : <span className="eyebrow">{tf.kind}</span>}
                  {editing
                    ? <button className="btn btn--link" style={{fontSize:11, color:"var(--pink-500)"}} onClick={() => patch("type", bio.type.filter((_, j) => j !== i))}>{t("discovery.common.remove")}</button>
                    : <span className="pill" style={{height:18, padding:"0 8px", fontSize:9.5}}>{tf.license}</span>}
                </div>
                <div className="brand-font-specimen" style={{"--brand-specimen-font":ff, fontFamily:ff, fontSize:52, lineHeight:1, color:"var(--c-ink)", fontWeight:600, letterSpacing:"-0.02em"}}>{typeHero}</div>
                <div className="brand-font-specimen" style={{"--brand-specimen-font":ff, fontFamily:ff, fontSize:15, color:"var(--c-dim)", marginTop:8, lineHeight:1.4}}>{typeSample}</div>
                {tf.sourceId && (
                  <div aria-live="polite" style={{fontSize:10.5, marginTop:8, color:loadedFonts[tf.sourceId] ? "var(--green-600)" : fontFailures[tf.sourceId] ? "var(--pink-500)" : "var(--c-faint)"}}>
                    {loadedFonts[tf.sourceId] ? t("discovery.visualIntake.fontReady") : fontFailures[tf.sourceId] ? t("discovery.visualIntake.fontError") : t("discovery.visualIntake.fontLoading")}
                  </div>
                )}
                <div style={{marginTop:14, paddingTop:12, borderTop:"1px dashed var(--c-line-2)"}}>
                  {editing
                    ? <div style={{display:"flex", flexDirection:"column", gap:6}}>
                        <EditInput value={tf.family} onChange={(v) => updType(i, { family: v })} placeholder={t("discovery.visual.familyPlaceholder")} />
                        <div style={{display:"flex", gap:6}}>
                          <EditInput value={tf.size} onChange={(v) => updType(i, { size: v })} placeholder={t("discovery.visual.sizePlaceholder")} mono />
                          <EditInput value={tf.license} onChange={(v) => updType(i, { license: v })} placeholder={t("discovery.visual.licensePlaceholder")} />
                        </div>
                        <EditInput value={tf.suggest} onChange={(v) => updType(i, { suggest: v })} placeholder={t("discovery.visual.webAltPlaceholder")} />
                      </div>
                    : <>
                        <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
                          <span style={{fontSize:13, fontWeight:500, color:"var(--c-ink)"}}>{tf.family}</span>
                          <span style={{fontFamily:"var(--font-mono)", fontSize:10.5, color:"var(--c-faint)"}}>{tf.size}</span>
                        </div>
                        {tf.suggest&&<div style={{fontSize:11.5, color:"var(--c-faint)", marginTop:4}}>{t("discovery.visual.webAlt")} · {tf.suggest}</div>}
                      </>}
                </div>
              </div>
            );
          })}
          {editing && (
            <button className="card" onClick={() => patch("type", [...bio.type, { kind:"New face", family:"Family name", size:"16/24", license:"free", suggest:"system" }])}
              style={{display:"flex", alignItems:"center", justifyContent:"center", minHeight:120, borderStyle:"dashed", cursor:"pointer", color:"var(--c-dim)", gap:6}}>
              <Icon name="plus" size={16} /> {t("discovery.common.addTypeface")}
            </button>
          )}
        </div>
      </section>

      {/* IMAGERY */}
      <section>
        <BioSectionHead label={t("discovery.visual.imageryHead")} source="visual evidence" />
        {(editing||bio.grade)&&<div className="card card--inset" style={{padding:"14px 16px", marginBottom:12}}>
          <div className="eyebrow" style={{marginBottom:6}}>{t("discovery.visual.grade")}</div>
          {editing
            ? <EditInput area value={bio.grade} onChange={(v) => patch("grade", v)} />
            : <p style={{fontSize:14, color:"var(--c-ink)", lineHeight:1.5, margin:0}}>{bio.grade}</p>}
        </div>}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
          <div className="card" style={{padding:16, borderLeft:"3px solid var(--green-600)"}}>
            <div className="eyebrow eyebrow--green" style={{marginBottom:10}}>{t("discovery.visual.shootThis")}</div>
            {editing
              ? <StringListEditor items={bio.imagery} onChange={(v) => patch("imagery", v)} marker="✓" color="var(--green-600)" />
              : <ul style={{margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:7}}>
                  {bio.imagery.map((x, i) => <li key={i} style={{fontSize:13, color:"var(--c-ink)", display:"flex", gap:8, lineHeight:1.45}}><span style={{color:"var(--green-600)"}}>✓</span> {x}</li>)}
                </ul>}
          </div>
          <div className="card" style={{padding:16, borderLeft:"3px solid var(--pink-500)"}}>
            <div className="eyebrow eyebrow--pink" style={{marginBottom:10}}>{t("discovery.visual.neverThis")}</div>
            {editing
              ? <StringListEditor items={bio.avoid} onChange={(v) => patch("avoid", v)} marker="✕" color="var(--pink-500)" />
              : <ul style={{margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:7}}>
                  {bio.avoid.map((x, i) => <li key={i} style={{fontSize:13, color:"var(--c-ink)", display:"flex", gap:8, lineHeight:1.45}}><span style={{color:"var(--pink-500)"}}>✕</span> {x}</li>)}
                </ul>}
          </div>
        </div>
      </section>
    </div>
  );
}

function BioStrategic({ strat, patchStrategic, editing }) {
  const { t } = useLocale();
  return (
    <div style={{display:"grid", gridTemplateColumns: "1fr 1fr", gap: 18}}>
      <div className="card" style={{padding: 18}}>
        <div className="eyebrow eyebrow--yellow" style={{marginBottom: 8}}>{t("discovery.strategic.watchouts")}</div>
        {editing
          ? <StringListEditor items={strat.watchouts} onChange={(v) => patchStrategic("watchouts", v)} />
          : <ul style={{margin: 0, paddingLeft: 0, listStyle:"none", display:"flex", flexDirection:"column", gap: 10}}>
              {strat.watchouts.map((x, i) => <li key={i} style={{fontSize: 13.5, color:"var(--c-ink)"}}>{x}</li>)}
            </ul>}
      </div>
      <div className="card" style={{padding: 18}}>
        <div className="eyebrow" style={{color:"var(--orange-600)", marginBottom: 8}}>{t("discovery.strategic.gaps")}</div>
        {editing
          ? <StringListEditor items={strat.gaps} onChange={(v) => patchStrategic("gaps", v)} />
          : <ul style={{margin:0, paddingLeft: 0, listStyle:"none", display:"flex", flexDirection:"column", gap: 10}}>
              {strat.gaps.map((x, i) => <li key={i} style={{fontSize: 13.5, color:"var(--c-ink)"}}>{x}</li>)}
            </ul>}
      </div>
      <div className="card" style={{padding: 18, gridColumn: "1 / -1"}}>
        <div className="eyebrow eyebrow--pink" style={{marginBottom: 8}}>{t("discovery.strategic.whatNot")}</div>
        {editing
          ? <StringListEditor items={strat.notList} onChange={(v) => patchStrategic("notList", v)} marker="✕" color="var(--pink-500)" />
          : <ul style={{margin: 0, paddingLeft: 18, display:"grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
              {strat.notList.map((x, i) => <li key={i} style={{fontSize:13.5}}>{x}</li>)}
            </ul>}
      </div>
      {(editing||strat.diagnosis)&&<div className="card" style={{padding: 18, gridColumn: "1 / -1"}}>
        <div className="eyebrow eyebrow--purple" style={{marginBottom: 8}}>{t("discovery.strategic.diagnosis")}</div>
        {editing
          ? <EditInput area value={strat.diagnosis} onChange={(v) => patchStrategic("diagnosis", v)} />
          : <p style={{fontSize: 16, lineHeight: 1.55, color:"var(--c-ink)", margin: 0}}>"{strat.diagnosis}"</p>}
      </div>}
    </div>
  );
}
function BioSources({ brandId, sources, setSources, feed, setFeed, reading, addReference, onSourceAdded, editing, go }) {
  const { t } = useLocale();
  const fileRef = React.useRef(null);
  const [uploadingFile, setUploadingFile] = useDState(false);
  const [uploadError, setUploadError] = useDState(null);
  const brandSources = sources.filter((s) => s.brandEvidence !== false);
  const competitorSources = sources.filter((s) => s.brandEvidence === false);
  const total = brandSources.reduce((a, s) => a + s.n, 0);
  const onKey = (e) => { if (e.key === "Enter") { e.preventDefault(); addReference(); } };
  const uploadFile = async (file) => {
    if (!file || !brandId || uploadingFile) return;
    setUploadError(null);
    const validation=validateUpload({filename:file.name,mime:file.type,size:file.size});
    if(!validation.ok){setUploadError(`${file.name}: ${validation.message}`);return;}
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.set("bucket", "foundations");
      form.set("file", withUploadType(file));
      const res = await apiFetch(`/api/bios/${brandId}/sources/upload`, { method:"POST", body:form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSources(s => [{ src:file.name, date:t("discovery.sources.justNow"), n:0, fresh:true }, ...s]);
      onSourceAdded?.();
    } catch(error) {
      setUploadError(`${file.name}: ${error?.message||t("discovery.upload.failed")}`);
    } finally {
      setUploadingFile(false);
    }
  };
  return (
    <div>
      {/* Feed composer */}
      <div className="card card--inset" style={{padding:18, marginBottom:22}}>
        <div style={{display:"flex", alignItems:"center", gap:9, marginBottom:12}}>
          <BrandolphDot state={reading ? "thinking" : "idle"} />
          <div>
            <div style={{fontSize:14, fontWeight:600, color:"var(--c-ink)"}}>{t("discovery.sources.feedBrandolph")}</div>
            <div style={{fontSize:12, color:"var(--c-faint)"}}>{t("discovery.sources.feedDesc")}</div>
          </div>
        </div>
        <div style={{display:"flex", gap:10}}>
          <input
            value={feed}
            onChange={(e) => setFeed(e.target.value)}
            onKeyDown={onKey}
            disabled={reading}
            placeholder={t("discovery.sources.pastePlaceholder")}
            style={{flex:1, height:42, borderRadius:9, border:"1px solid var(--c-line-2)", background:"var(--c-bg)", padding:"0 14px", fontSize:14, color:"var(--c-ink)", outline:"none"}}
          />
          <button className="btn btn--ghost" disabled={reading || !feed.trim()} onClick={() => addReference()}>
            {reading ? <><BrandolphDot state="thinking" size={11} /> {t("discovery.sources.reading")}</> : <><Icon name="plus" size={14} /> {t("discovery.sources.readIt")}</>}
          </button>
        </div>
        <div style={{display:"flex", gap:8, marginTop:12, flexWrap:"wrap"}}>
          <input ref={fileRef} type="file" accept={SOURCE_FILE_ACCEPT} style={{display:"none"}} onChange={(e) => { uploadFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button className="btn btn--ghost btn--sm" disabled={reading || uploadingFile} onClick={() => fileRef.current?.click()}><Icon name="files" size={13} /> {uploadingFile ? "Uploading…" : t("discovery.sources.uploadDoc")}</button>
        </div>
        {uploadError&&<p role="alert" className="discovery-file-status error">{uploadError}</p>}
      </div>

      {/* Ledger header */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6}}>
        <div className="eyebrow">{t("discovery.sources.ledger", { sources: brandSources.length, signals: total })}</div>
        <div style={{fontSize:11.5, color:"var(--c-faint)", fontStyle:"italic"}}>{t("discovery.sources.compounds")}</div>
      </div>

      {/* Source ledger */}
      <div>
        {brandSources.map((s, i) => (
          <div key={i} style={{display:"grid", gridTemplateColumns:"1fr auto auto", gap: 14, padding:"12px 0", borderBottom: "1px solid var(--c-line)", alignItems:"center", animation: s.fresh ? "cvPopIn 260ms ease" : "none"}}>
            <div>
              <div style={{fontSize: 13.5, color:"var(--c-ink)", fontWeight:500, display:"flex", alignItems:"center", gap:8}}>
                {s.src}
                {s.fresh && <span className="pill" style={{height:18, padding:"0 8px", fontSize:9.5, background:"var(--green-50, rgba(127,163,122,0.16))", color:"var(--green-600)"}}>{t("discovery.sources.new")}</span>}
              </div>
              <div style={{fontFamily:"var(--font-mono)", fontSize: 10.5, color:"var(--c-faint)", marginTop: 2, letterSpacing:"0.04em"}}>{s.date}</div>
            </div>
            <span className="pill">{t("discovery.sources.signals", { count: s.n })}</span>
            {editing
              ? <button className="btn btn--link" style={{fontSize: 12, color:"var(--pink-500)"}} onClick={() => setSources(sources.filter((row) => row !== s))}>{t("discovery.common.remove")}</button>
              : <button className="btn btn--link" style={{fontSize: 12}} onClick={() => go("discovery")}>{t("discovery.sources.reExtract")}</button>}
          </div>
        ))}
      </div>
      {competitorSources.length > 0 && <div style={{marginTop:22}}>
        <div className="eyebrow" style={{marginBottom:6}}>{t("discovery.sources.competitorLedger", { count: competitorSources.length })}</div>
        {competitorSources.map((s, i) => (
          <div key={`competitor-${i}`} style={{display:"grid", gridTemplateColumns:"1fr auto", gap:14, padding:"12px 0", borderBottom:"1px solid var(--c-line)"}}>
            <div style={{fontSize:13.5, color:"var(--c-ink)"}}>{s.src}</div>
            <span className="pill">{t("discovery.sources.competitorTag")}</span>
          </div>
        ))}
      </div>}
    </div>
  );
}

Object.assign(window, { Discovery, BioViewer });

export { Discovery, BioViewer, useLiveBio, payloadToFields, fieldsToPayload, discoFieldStatus };

export function BioReviewSection({payload,section}){
 const snapshot=payloadToFields(payload);
 if(section==="positioning")return <BioCompetitive value={snapshot.positioning} aspirations={payload?.aspirations} editing={false}/>;
 if(section==="visual")return <BioVisual bio={snapshot} editing={false}/>;
 if(section==="strategic")return <BioStrategic strat={snapshot.strategic} editing={false}/>;
 return <BioFieldList items={snapshot[section]} editing={false}/>;
}
