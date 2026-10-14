import { OutputShelfCard } from "./lib/task-output-shelf.jsx";
import React, { useEffect, useMemo, useState } from "react";
import { useLocale } from "./lib/i18n.js";
import { officeModel, OFFICE_ROOMS } from "./lib/office-model.js";
import "./agency-office.css";
import { BoutiqueOffice } from "./boutique-office.jsx";
import { agencyAvatarSource } from "./lib/agency-avatars.js";
import { PixelOffice } from "./pixel-office/PixelOffice.jsx";

const COPY = {
  en: {
    office: "Agency office", canvas: "Canvas", floor: "The agency floor", live: "Your crew, at work.",
    preview: "Interactive preview", previewNote: "Simulated project · no AI calls or credits", previewTitle: "A little launch. A whole agency.",
    briefTitle: "Launch a new coffee ritual", briefBody: "Create three social posts for a small specialty coffee brand. Warm, unhurried, and quietly confident. Pair each post with a visual direction.",
    start: "Play the project", pause: "Pause", resume: "Resume", reset: "Reset", newBrief: "Create a real brief", inspect: "Click a teammate to see their assignment.",
    crew: "On this project", outputs: "Output shelf", empty: "Finished work will land here.", brief: "Project brief", orchestrator: "Orchestrator", coordinating: "Coordinating the crew", ready: "Crew ready", running: "Work in progress", complete: "Generation complete · needs review", review: "Needs review", failed: "Needs attention", waiting: "Waiting for assignment", done: "Complete", approved: "Approved", flagged: "Needs review", queued: "Queued", stopped: "Failed", task: "Current assignment", open: "Open work", selected: "Selected teammate", zoomIn: "Zoom in", zoomOut: "Zoom out", fit: "Fit", motion: "Reduce motion", all: "All", noCrew: "No teammates in this room yet.", status: "Project status", closed: "Close", rooms: ["Strategy & research", "Concept studio", "Copy room", "Visual studio", "Web & motion", "Review desk"],
  },
  es: {
    office: "Oficina de agencia", canvas: "Lienzo", floor: "La agencia", live: "Tu equipo, en acción.",
    preview: "Vista previa interactiva", previewNote: "Proyecto simulado · sin llamadas a IA ni créditos", previewTitle: "Un pequeño lanzamiento. Toda una agencia.",
    briefTitle: "Lanzar un nuevo ritual de café", briefBody: "Crea tres publicaciones para una pequeña marca de café de especialidad. Un tono cálido, pausado y seguro. Acompaña cada publicación con una dirección visual.",
    start: "Reproducir proyecto", pause: "Pausar", resume: "Continuar", reset: "Reiniciar", newBrief: "Crear un brief real", inspect: "Selecciona a alguien del equipo para ver su tarea.",
    crew: "En este proyecto", outputs: "Entregables", empty: "El trabajo terminado aparecerá aquí.", brief: "Brief del proyecto", orchestrator: "Orquestador", coordinating: "Coordinando al equipo", ready: "Equipo preparado", running: "Trabajo en curso", complete: "Generación completada · pendiente de revisión", review: "Pendiente de revisión", failed: "Necesita atención", waiting: "Esperando asignación", done: "Completado", approved: "Aprobado", flagged: "Pendiente de revisión", queued: "En cola", stopped: "Error", task: "Tarea actual", open: "Abrir trabajo", selected: "Miembro seleccionado", zoomIn: "Acercar", zoomOut: "Alejar", fit: "Ajustar", motion: "Reducir movimiento", all: "Todo", noCrew: "Todavía no hay nadie en esta sala.", status: "Estado del proyecto", closed: "Cerrar", rooms: ["Estrategia e investigación", "Estudio de concepto", "Sala de copy", "Estudio visual", "Web y movimiento", "Mesa de revisión"],
  },
  ar: {
    office: "مكتب الوكالة", canvas: "اللوحة", floor: "الوكالة", live: "فريقك يعمل.", preview: "معاينة تفاعلية", previewNote: "مشروع محاكى · دون استدعاء الذكاء الاصطناعي أو استخدام الرصيد", previewTitle: "إطلاق صغير. وكالة كاملة.", briefTitle: "إطلاق طقوس قهوة جديدة", briefBody: "أنشئ ثلاثة منشورات لعلامة قهوة متخصصة. نبرة دافئة وواثقة مع توجيه بصري لكل منشور.", start: "تشغيل المشروع", pause: "إيقاف مؤقت", resume: "متابعة", reset: "إعادة البدء", newBrief: "إنشاء موجز حقيقي", inspect: "اختر عضوًا في الفريق لعرض مهمته.", crew: "فريق المشروع", outputs: "المخرجات", empty: "سيظهر العمل المكتمل هنا.", brief: "موجز المشروع", orchestrator: "المنسق", coordinating: "تنسيق الفريق", ready: "الفريق جاهز", running: "العمل جارٍ", complete: "اكتمل الإنشاء · بانتظار المراجعة", review: "يحتاج إلى مراجعة", failed: "يحتاج إلى انتباه", waiting: "بانتظار المهمة", done: "مكتمل", approved: "معتمد", flagged: "يحتاج إلى مراجعة", queued: "في الانتظار", stopped: "فشل", task: "المهمة الحالية", open: "فتح العمل", selected: "عضو الفريق المحدد", zoomIn: "تكبير", zoomOut: "تصغير", fit: "ملاءمة", motion: "تقليل الحركة", all: "الكل", noCrew: "لا يوجد أعضاء في هذه الغرفة بعد.", status: "حالة المشروع", closed: "إغلاق", rooms: ["الاستراتيجية والبحث", "استوديو الأفكار", "غرفة الكتابة", "الاستوديو البصري", "الويب والحركة", "مكتب المراجعة"],
  },
};

export function useOfficeCopy() {
  const { locale } = useLocale();
  return COPY[locale] || COPY.en;
}

export function AgencyOffice({ nodeData = [], onNodeClick, toolbarExtra, preview = false, officeScope = "preview" }) {
  const copy = useOfficeCopy();
  const model = useMemo(() => officeModel(nodeData, window.CI_AGENTS || []), [nodeData]);
  const [officeStyle, setOfficeStyle] = useState("studio");
  const [selectedId, setSelectedId] = useState(null);
  const [roomFilter, setRoomFilter] = useState("all");
  const [reduced, setReduced] = useState(false);
  const [openedBoard, setOpenedBoard] = useState(null);
  const openWork = node => node?.kind === "moodboard" ? setOpenedBoard(node) : onNodeClick?.(node);
  const selected = model.crew.find(agent => agent.node.id === selectedId);
  const stateLabel = state => ({ running: copy.running, done: copy.done, flagged: copy.flagged, failed: copy.stopped, queued: copy.queued }[state] || copy.waiting);
  const status = model.failed ? copy.failed : model.active.length ? copy.running : model.flagged ? copy.review : model.crew.length && model.finished === model.crew.length ? copy.complete : copy.ready;
  const brief = nodeData.find(node => node.kind === "brief");
  const visibleCrew = model.crew.filter(agent => roomFilter === "all" || agent.room === roomFilter);

  return <section className={`ao-workspace ${reduced ? "ao-reduced" : ""}`} aria-label={copy.office}>
    <div className="ao-floor-header">
      <div><span className="ao-eyebrow">{copy.floor}</span><h2>{copy.live}</h2></div>
      <div className="ao-project-state" role="status"><span className={`ao-status-dot ${model.active.length ? "is-active" : ""}`} />{status}<span className="ao-count">{model.finished}/{model.crew.length}</span></div>
    </div>
    <div className="ao-main">
      <div className="ao-floor">
        {preview && <div className="ao-surface-switch"><button aria-pressed={officeStyle==="studio"} onClick={()=>setOfficeStyle("studio")}>{copy.office}</button><button aria-pressed={officeStyle==="pixel"} onClick={()=>setOfficeStyle("pixel")}>Pixel layout editor</button></div>}
        {officeStyle === "studio" ? <BoutiqueOffice key={officeScope} scope={officeScope} crew={model.crew} selectedId={selectedId} onSelect={setSelectedId} onBrief={()=>onNodeClick?.(brief)} reduced={reduced} copy={copy} /> : <PixelOffice crew={model.crew} selectedId={selectedId} onSelect={setSelectedId} onBrief={() => onNodeClick?.(brief)} reduced={reduced} scope={officeScope} />}
        <div className="ao-map-controls"><span>{copy.inspect}</span><label className="ao-motion"><input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} />{copy.motion}</label></div>
      </div>
      <aside className="ao-sidebar">
        <button className="ao-brief-card" onClick={() => onNodeClick?.(brief)}><span className="ao-eyebrow">{copy.brief}</span><strong>{brief?.title || copy.briefTitle}</strong><span>{preview ? copy.previewNote : brief?.sub}</span><span className="ao-link">↗</span></button>
        <div className="ao-roster-heading"><span className="ao-eyebrow">{copy.crew}</span><span>{model.crew.length}</span></div>
        <select className="ao-room-filter" aria-label={copy.crew} value={roomFilter} onChange={event => setRoomFilter(event.target.value)}><option value="all">{copy.all}</option>{OFFICE_ROOMS.map((room, index) => <option key={room.id} value={room.id}>{copy.rooms[index]}</option>)}</select>
        <div className="ao-roster">{visibleCrew.map(agent => <button key={agent.node.id} className={`ao-roster-row ${selectedId === agent.node.id ? "is-selected" : ""}`} onClick={() => setSelectedId(agent.node.id)} aria-pressed={selectedId === agent.node.id}>
          <i className={`ao-state-mark state-${agent.state}`} /><img className="ao-roster-avatar" src={agencyAvatarSource(agent)} alt="" /><span><strong>{agent.name}</strong><small>{agent.dept}</small></span><span className="ao-roster-state">{stateLabel(agent.state)}</span>
        </button>)}{!visibleCrew.length && <p className="ao-empty">{copy.noCrew}</p>}</div>
        {selected ? <div className="ao-inspector"><span className="ao-eyebrow">{copy.selected}</span><h3>{selected.name}</h3><p>{selected.node.sub || selected.job || copy.waiting}</p><span className="ao-inspector-state">{stateLabel(selected.state)}</span>{["running", "done", "flagged"].includes(selected.state) && <button className="ao-button" onClick={() => openWork(selected.node)}>{copy.open} ↗</button>}</div> : <div className="ao-inspector ao-orchestrator"><span className="ao-eyebrow">Brandolph / L1</span><p>{model.active.length ? copy.coordinating : copy.inspect}</p></div>}
      </aside>
    </div>
    <div className="ao-output-header"><span className="ao-eyebrow">{copy.outputs}</span><span>{model.outputs.length}</span>{toolbarExtra && <div className="ao-output-actions">{toolbarExtra}</div>}</div>
    <div className="ao-outputs">{model.outputs.length ? model.outputs.map(node => <OutputShelfCard key={node.id} node={node} copy={copy} onOpen={openWork} />) : <div className="ao-empty-shelf"><span>↳</span>{copy.empty}</div>}</div>
    {openedBoard && <OfficePreviewDialog node={openedBoard} copy={copy} preview={false} onClose={() => setOpenedBoard(null)} />}
  </section>;
}

const PREVIEW_IDS = ["a01", "a36", "a16", "a41", "a18", "a24"];
const PREVIEW_STEPS = ["queued", "running", "done"];
function previewNodes(step, copy) {
  const agents = PREVIEW_IDS.map(id => window.CI_AGENTS?.find(agent => agent.id === id)).filter(Boolean);
  const nodes = [{ id: "brief", kind: "brief", title: copy.briefTitle, sub: copy.briefBody }];
  agents.forEach((agent, index) => {
    const start = [1, 4, 7, 10, 13, 13][index];
    const state = PREVIEW_STEPS[step < start ? 0 : step < start + 3 ? 1 : 2];
    const source = [null, "a01", "a36", "a16", "a16", "a41"][index];
    nodes.push({ id: `spec-${agent.id}`, specId: agent.id, kind: "specialist", title: agent.name, state, inputFrom: source ? `spec-${source}` : undefined, sub: state === "queued" ? copy.waiting : state === "running" ? agent.job : copy.done });
  });
  if (step >= 10) {
    const bodies = ["A quieter kind of morning. Your coffee, your pace.", "Good things take their time. Start with a cup worth slowing down for.", "Small batches. Long conversations. Meet your new daily ritual."];
    bodies.forEach((body, index) => nodes.push({ id: `spec-a16-d${index}`, kind: "deliverable", title: `${copy.briefTitle} / 0${index + 1}`, body, platform: "instagram", status: step >= 16 ? "approved" : "pending", specialistName: "Social Captions", sub: step >= 16 ? copy.done : copy.review }));
  }
  return nodes;
}

export function OfficePreview({ go }) {
  const copy = useOfficeCopy();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [opened, setOpened] = useState(null);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setStep(value => Math.min(16, value + 1)), 1400);
    return () => window.clearInterval(timer);
  }, [playing]);
  useEffect(() => { if (step === 16) setPlaying(false); }, [step]);
  const nodes = previewNodes(step, copy);
  const toggle = () => { if (step === 16) setStep(0); setPlaying(value => !value); };
  return <div className="ao-preview-page">
    <header className="ao-preview-header"><div><span className="ao-eyebrow">BRAND OS / {copy.preview}</span><h1>{copy.previewTitle}</h1><p>{copy.previewNote}</p></div><div className="ao-preview-actions"><button className="ao-button" onClick={() => { setPlaying(false); setStep(0); setOpened(null); }}>{copy.reset}</button><button className="ao-button ao-button-primary" onClick={toggle}>{playing ? copy.pause : step > 0 && step < 16 ? copy.resume : copy.start} <span>↗</span></button>{go && <button className="ao-button" onClick={() => go("home")}>{copy.newBrief}</button>}</div></header>
    <AgencyOffice nodeData={nodes} onNodeClick={node => node && setOpened(node)} preview />
    {opened && <div className="ao-modal-backdrop" onClick={() => setOpened(null)}><OfficePreviewDialog node={opened} copy={copy} onClose={() => setOpened(null)} /></div>}
  </div>;
}

function OfficePreviewDialog({ node, copy, onClose, preview = true }) {
  const ref = React.useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="ao-modal" onCancel={onClose} onClick={event => event.stopPropagation()} aria-labelledby="ao-preview-dialog-title"><span className="ao-eyebrow">{preview ? copy.preview : copy.outputs}</span><h2 id="ao-preview-dialog-title">{node.title}</h2><p>{node.body || node.outputText || node.sub}</p>{node.tiles?.map((url, index) => <img key={index} src={url} alt={`${node.title} ${index + 1}`} style={{width:"100%", marginBottom:12}} />)}{preview && <small>{copy.previewNote}</small>}<button className="ao-button" onClick={onClose}>{copy.closed}</button></dialog>;
}
