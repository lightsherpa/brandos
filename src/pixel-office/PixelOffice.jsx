import React, {useEffect, useRef, useState} from "react";
import {useLocale} from "../lib/i18n.js";
import {OfficeState} from "../vendor/pixel-agents/webview-ui/src/office/engine/officeState.ts";
import {renderFrame} from "../vendor/pixel-agents/webview-ui/src/office/engine/renderer.ts";
import {getCatalogEntry, getCatalogByCategory} from "../vendor/pixel-agents/webview-ui/src/office/layout/furnitureCatalog.ts";
import {canPlaceFurniture, placeFurniture, moveFurniture, removeFurniture, rotateFurniture} from "../vendor/pixel-agents/webview-ui/src/office/editor/editorActions.ts";
import {loadPixelAssets} from "./assets.js";
import {createPixelLayout, applyFloorTheme, readOfficePreferences, FLOOR_THEMES, OFFICE_PRESETS} from "./layouts.js";
import "./pixel-office.css";

const WORDS = {
  en: {presets:["Classic agency", "Creative studio", "Brand headquarters"],customize:"Customise office",close:"Done", floor:"Floor colours", floors:["Original","Oak","Sage","Slate"], appearance:"Team look",character:"Character",name:"Office name",defaultName:"BrandOS by Caastor studio", tools:"Furniture",select:"Select or move",place:"Add furniture",remove:"Remove",rotate:"Rotate",reset:"Reset this layout",save:"Save office",saved:"Saved in this browser",unsaved:"Unsaved changes",invalid:"That spot is taken. Choose a free one.",hint:"Click a piece of furniture, then a free spot to move it. Drag the floor to look around.",placeHint:"Choose an item, then click a free spot to place it.",loading:"Loading Pixel Agents office…",failed:"We couldn't load the office.",retry:"Retry", zoomIn:"Zoom in",zoomOut:"Zoom out",fit:"Fit",labels:"Show names",motion:"Reduce motion",source:"Art: Pixel Agents",resetConfirm:"Reset this layout? Your saved changes will be replaced.",noSelection:"Pick someone from the list to change their look.",status:"Customise your office",invalidSave:"Everyone on the team needs a desk. Keep the work seats in the layout."},
  es: {presets:["Agencia clásica","Estudio creativo","Sede de marca"],customize:"Personalizar oficina",close:"Terminar edición",floor:"Paleta del suelo",floors:["Original","Roble","Salvia","Pizarra"],appearance:"Aspecto del equipo",character:"Personaje",name:"Nombre de la oficina",defaultName:"Agencia Brand OS",tools:"Mobiliario",select:"Seleccionar / mover",place:"Añadir muebles",remove:"Eliminar",rotate:"Girar",reset:"Restablecer plantilla",save:"Guardar oficina",saved:"Guardado en este navegador",unsaved:"Cambios sin guardar",invalid:"Esa posición está ocupada. Elige una baldosa libre.",hint:"Selecciona un mueble y pulsa una baldosa libre para moverlo. Arrastra el suelo para desplazar la vista.",placeHint:"Elige un mueble y pulsa una baldosa libre para colocarlo.",loading:"Cargando oficina de Pixel Agents…",failed:"No se pudieron cargar los recursos.",retry:"Reintentar",zoomIn:"Acercar",zoomOut:"Alejar",fit:"Ajustar",labels:"Mostrar nombres",motion:"Reducir movimiento",source:"Motor y sprites: Pixel Agents",resetConfirm:"¿Restablecer esta plantilla? Se sustituirán los cambios guardados de esta oficina.",noSelection:"Selecciona a alguien en la lista para personalizar su aspecto.",status:"Personalización de oficina",invalidSave:"Cada miembro necesita un escritorio. Conserva los asientos de trabajo."},
  ar: {presets:["وكالة كلاسيكية","استوديو إبداعي","مقر العلامة"],customize:"تخصيص المكتب",close:"إنهاء التعديل",floor:"ألوان الأرضية",floors:["الأصلي","البلوط","الأخضر","الرمادي"],appearance:"مظهر الفريق",character:"الشخصية",name:"اسم المكتب",defaultName:"وكالة Brand OS",tools:"الأثاث",select:"اختيار / نقل",place:"إضافة أثاث",remove:"إزالة",rotate:"تدوير",reset:"إعادة ضبط القالب",save:"حفظ المكتب",saved:"محفوظ في هذا المتصفح",unsaved:"تغييرات غير محفوظة",invalid:"الموقع محجوز. اختر مربعًا متاحًا.",hint:"اختر قطعة أثاث ثم مربعًا متاحًا لنقلها. اسحب الأرضية لتحريك العرض.",placeHint:"اختر الأثاث ثم انقر مربعًا متاحًا.",loading:"تحميل مكتب Pixel Agents…",failed:"تعذر تحميل الموارد.",retry:"إعادة المحاولة",zoomIn:"تكبير",zoomOut:"تصغير",fit:"ملاءمة",labels:"عرض الأسماء",motion:"تقليل الحركة",source:"المحرك والرسومات: Pixel Agents",resetConfirm:"إعادة ضبط القالب واستبدال التغييرات المحفوظة؟",noSelection:"اختر عضوًا من القائمة لتخصيص مظهره.",status:"تخصيص المكتب",invalidSave:"يحتاج كل عضو إلى مقعد عمل. احتفظ بمقاعد الفريق."},
};

export function PixelOffice({crew, selectedId, onSelect, onBrief, reduced, scope = "preview"}) {
  const {locale} = useLocale();
  const words = WORDS[locale] || WORDS.en;
  const storageKey = `ci_pixel_office_v1:${scope}`;
  const [prefs, setPrefs] = useState(() => readOfficePreferences(localStorage, storageKey) || {version:1,preset:"classic",name:"",appearance:{}});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [tool, setTool] = useState("select");
  const [itemType, setItemType] = useState("PLANT");
  const [selectedFurniture, setSelectedFurniture] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [zoom, setZoom] = useState(1);
  const [labels, setLabels] = useState(true);
  const [retry, setRetry] = useState(0);
  const canvasRef = useRef(null);
  const officeRef = useRef(null);
  const viewRef = useRef({offsetX:0, offsetY:0, scale:1, panX:0,panY:0});
  const idRef = useRef(new Map());
  const nextId = useRef(1);
  const statuses = useRef(new Map());
  const live = useRef({crew,selectedId,onSelect,onBrief,reduced,zoom,labels});
  live.current = {crew,selectedId,onSelect,onBrief,reduced,zoom,labels};
  const drag = useRef(null);

  useEffect(() => {
    setPrefs(readOfficePreferences(localStorage, storageKey) || {version:1,preset:"classic",name:"",appearance:{}});
    setDirty(false); setSelectedFurniture(null);
  }, [storageKey]);

  useEffect(() => {
    let disposed = false;
    setReady(false); setError("");
    loadPixelAssets().then(() => {
      if (disposed) return;
      officeRef.current = new OfficeState(createPixelLayout("classic", crew.length));
      statuses.current.clear();
      setReady(true);
    }).catch(err => {if (!disposed) setError(err.message);});
    return () => {disposed = true;};
  }, [retry]);

  useEffect(() => {
    if (!ready) return;
    const office = officeRef.current;
    const saved = prefs.layouts?.[prefs.preset] || prefs.layout;
    // Validate saved asset IDs before handing data to the upstream engine.
    let layout = saved && saved.furniture.every(item => getCatalogEntry(item.type)) ? saved : createPixelLayout(prefs.preset, crew.length);
    const workingSeats = layout.furniture.filter(item => item.uid.startsWith("staff-seat-")).length;
    if (workingSeats < crew.length + 1) layout = createPixelLayout(prefs.preset, crew.length);
    office.rebuildFromLayout(layout);
    office.addAgent(0, 0, 35, "staff-seat-0", true);
    for (const [id, numericId] of idRef.current) if (!crew.some(agent => agent.node.id === id)) {
      office.removeAgent(numericId); idRef.current.delete(id); statuses.current.delete(numericId);
    }
    crew.forEach((agent, index) => {
      if (!idRef.current.has(agent.node.id)) idRef.current.set(agent.node.id, nextId.current++);
      const numericId = idRef.current.get(agent.node.id);
      const look = prefs.appearance?.[agent.id];
      office.addAgent(numericId, look?.palette ?? index % 6, look?.hue ?? 0, `staff-seat-${index + 1}`, true);
      const character = office.characters.get(numericId);
      if (character) {character.palette = look?.palette ?? index % 6; character.hueShift = look?.hue ?? 0;}
      office.reassignSeat(numericId, `staff-seat-${index + 1}`);
    });
  }, [ready,prefs,crew.map(agent => agent.node.id).join("|")]);

  useEffect(() => {
    if (!ready) return;
    const office = officeRef.current;
    crew.forEach(agent => {
      const id = idRef.current.get(agent.node.id);
      if (statuses.current.get(id) !== agent.state) {
        office.setAgentActive(id, agent.state === "running");
        office.setAgentTool(id, agent.state === "running" ? (/QA|Research|Diagnostician/i.test(agent.name) ? "Read" : "Write") : null);
        if (agent.state === "running") {office.dismissBubble(id); office.sendToSeat(id);}
        if (agent.state === "done") office.showWaitingBubble(id);
        if (["flagged", "failed"].includes(agent.state)) office.showPermissionBubble(id);
        statuses.current.set(id, agent.state);
      }
    });
    office.setAgentActive(0, crew.some(agent => agent.state === "running"));
    office.setAgentTool(0, "Read");
  }, [ready, crew]);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const resize = () => {const bounds = canvas.getBoundingClientRect(); canvas.width = Math.round(bounds.width * devicePixelRatio); canvas.height = Math.round(bounds.height * devicePixelRatio);};
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    let raf = 0, stopped = false, previous = 0;
    const frame = time => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (time - previous < 32) return;
      const dt = Math.min((time - previous) / 1000, .05); previous = time;
      const office = officeRef.current;
      const opts = live.current;
      const shouldReduce = opts.reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!document.hidden) office.update(shouldReduce ? 0 : dt);
      const layout = office.getLayout();
      const fit = Math.min(canvas.width / ((layout.cols + 2) * 16), canvas.height / ((layout.rows + 3) * 16));
      const scale = Math.max(.5, Math.floor(fit * opts.zoom * 4) / 4);
      const view = viewRef.current;
      ctx.imageSmoothingEnabled = false;
      const selected = idRef.current.get(opts.selectedId) ?? null;
      const offset = renderFrame(ctx,canvas.width,canvas.height,office.tileMap,office.furniture,office.getCharacters(),scale,view.panX,view.panY,
        {selectedAgentId:selected,hoveredAgentId:null,hoveredTile:null,seats:office.seats,characters:office.characters},undefined,layout.tileColors,layout.cols,layout.rows,layout.carpetTiles,layout.areas,layout.areaTiles,false,null,office.getPets());
      Object.assign(view,{...offset,scale});
      if (opts.labels) {
        const characters = office.getCharacters();
        const dpr = devicePixelRatio;
        ctx.font = `${Math.max(9,10 * dpr)}px monospace`; ctx.textAlign = "center";
        for (const character of characters) {
          if (canvas.width / dpr < 600 && character.id !== 0 && character.id !== selected) continue;
          const agent = opts.crew.find(item => idRef.current.get(item.node.id) === character.id);
          const name = character.id === 0 ? "Brandolph" : agent?.name;
          if (!name) continue;
          const x = view.offsetX + character.x * scale, y = view.offsetY + (character.y + 14) * scale;
          const w = ctx.measureText(name).width + 10 * dpr;
          ctx.fillStyle = "#151622dd"; ctx.fillRect(x - w/2,y - 9 * dpr,w,14 * dpr);
          ctx.fillStyle = character.id === 0 ? "#f3c875" : "#e5e2e2"; ctx.fillText(name,x,y + dpr);
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {stopped=true; cancelAnimationFrame(raf); observer.disconnect();};
  }, [ready]);

  const updateLayout = layout => {
    officeRef.current.rebuildFromLayout(layout);
    setPrefs(previous => ({...previous, layout:null, layouts:{...previous.layouts,[previous.preset]:layout}}));
    setDirty(true); setMessage("");
  };
  const choosePreset = preset => {setPrefs(previous => ({...previous,preset,layout:null}));setSelectedFurniture(null);setDirty(true);viewRef.current.panX=0;viewRef.current.panY=0;setZoom(1);};
  const hit = event => {
    const bounds = canvasRef.current.getBoundingClientRect(), view = viewRef.current;
    return {x:((event.clientX - bounds.left) * devicePixelRatio - view.offsetX) / view.scale,y:((event.clientY - bounds.top) * devicePixelRatio - view.offsetY) / view.scale};
  };
  const furnitureAt = point => {
    const layout = officeRef.current.getLayout();
    return [...layout.furniture].reverse().find(item => {const entry=getCatalogEntry(item.type);return entry && point.x >= item.col*16 && point.x < item.col*16+entry.footprintW*16 && point.y >= item.row*16 && point.y < item.row*16+entry.footprintH*16;});
  };
  const clickMap = event => {
    if (!ready) return;
    const point = hit(event), office=officeRef.current, layout=office.getLayout();
    const col=Math.floor(point.x/16), row=Math.floor(point.y/16);
    if (!editing) {
      const id=office.getCharacterAt(point.x,point.y);
      if (id===0) {onBrief?.();return;}
      const pair=[...idRef.current].find(([,value])=>value===id); if (pair) onSelect(pair[0]);
      return;
    }
    if (tool==="place") {
      if (!canPlaceFurniture(layout,itemType,col,row)) {setMessage(words.invalid);return;}
      updateLayout(placeFurniture(layout,{uid:`decor-${crypto.randomUUID()}`,type:itemType,col,row})); return;
    }
    const existing=furnitureAt(point);
    if (existing) {setSelectedFurniture(existing.uid);setMessage("");return;}
    if (selectedFurniture) {
      const item=layout.furniture.find(value=>value.uid===selectedFurniture);
      if (item && !canPlaceFurniture(layout,item.type,col,row,item.uid)) {setMessage(words.invalid);return;}
      updateLayout(moveFurniture(layout,selectedFurniture,col,row));
    }
  };
  const rotateSelected = () => {
    const layout = officeRef.current.getLayout();
    const rotated = rotateFurniture(layout, selectedFurniture, "cw");
    const item = rotated.furniture.find(value => value.uid === selectedFurniture);
    if (item && !canPlaceFurniture(layout, item.type, item.col, item.row, item.uid)) {setMessage(words.invalid);return;}
    updateLayout(rotated);
  };
  const save = () => {
    const layout=officeRef.current.getLayout();
    if (layout.furniture.filter(item=>item.uid.startsWith("staff-seat-")).length<crew.length+1) {setMessage(words.invalidSave);return;}
    try {localStorage.setItem(storageKey,JSON.stringify({...prefs,layout:null,layouts:{...prefs.layouts,[prefs.preset]:layout}}));setDirty(false);setMessage(words.saved);} catch {setMessage("We can't save in this browser.");}
  };
  const selectedAgent=crew.find(agent=>agent.node.id===selectedId);
  const catalog=ready ? ["decor","desks","chairs","electronics","wall","misc"].flatMap(category=>getCatalogByCategory(category)) : [];
  return <div className="po-office">
    <div className="po-toolbar"><div className="po-presets" role="group" aria-label={words.status}>{OFFICE_PRESETS.map((preset,index)=><button key={preset} aria-pressed={prefs.preset===preset} onClick={()=>choosePreset(preset)} disabled={!ready}><span>0{index+1}</span>{words.presets[index]}</button>)}</div><button className="po-edit-button" disabled={!ready} onClick={()=>setEditing(value=>!value)}>{editing?words.close:words.customize} {editing?"✓":"✎"}</button></div>
    {editing && <div className="po-editor">
      <div className="po-editor-row"><label>{words.name}<input value={prefs.name||""} placeholder={words.defaultName} maxLength={60} onChange={event=>{setPrefs(previous=>({...previous,name:event.target.value}));setDirty(true);}} /></label><label>{words.floor}<select defaultValue="" onChange={event=>updateLayout(applyFloorTheme(officeRef.current.getLayout(),event.target.value))}><option value="" disabled>—</option>{Object.keys(FLOOR_THEMES).map((theme,index)=><option key={theme} value={theme}>{words.floors[index]}</option>)}</select></label><div className="po-editor-buttons"><button onClick={save}>{words.save}</button><button onClick={()=>{if(window.confirm(words.resetConfirm)) {updateLayout(createPixelLayout(prefs.preset,crew.length));setSelectedFurniture(null);}}}>{words.reset}</button></div></div>
      <div className="po-editor-row"><label>{words.tools}<select value={tool} onChange={event=>{setTool(event.target.value);setSelectedFurniture(null);}}><option value="select">{words.select}</option><option value="place">{words.place}</option></select></label>{tool==="place" && <select aria-label={words.place} value={itemType} onChange={event=>setItemType(event.target.value)}>{catalog.map(item=><option key={item.type} value={item.type}>{item.label} / {item.category}</option>)}</select>}{selectedFurniture && <><span className="po-picked">{getCatalogEntry(officeRef.current.getLayout().furniture.find(item=>item.uid===selectedFurniture)?.type)?.label}</span><button onClick={rotateSelected}>{words.rotate}</button><button disabled={/^(staff-seat-|desk-|screen-)/.test(selectedFurniture)} onClick={()=>{updateLayout(removeFurniture(officeRef.current.getLayout(),selectedFurniture));setSelectedFurniture(null);}}>{words.remove}</button></>}</div>
      <div className="po-appearance"><span>{words.appearance}</span>{selectedAgent ? <><strong>{selectedAgent.name}</strong><div className="po-character-options">{Array.from({length:6},(_,index)=><button key={index} aria-label={`${words.character} ${index+1}`} aria-pressed={(prefs.appearance?.[selectedAgent.id]?.palette??crew.indexOf(selectedAgent)%6)===index} onClick={()=>{setPrefs(previous=>({...previous,appearance:{...previous.appearance,[selectedAgent.id]:{palette:index,hue:0}}}));setDirty(true);}} style={{backgroundImage:`url(/pixel-office/assets/characters/char_${index}.png)`}} />)}</div></> : <small>{words.noSelection}</small>}</div>
      <p className="po-editor-hint">{tool==="place"?words.placeHint:words.hint}</p>
    </div>}
    <div className={`po-stage ${editing ? "is-editing":""}`}>
      <div className="po-name">{prefs.name||words.defaultName}</div>
      <canvas ref={canvasRef} aria-label={words.defaultName} onPointerDown={event=>{if (!ready)return;drag.current={x:event.clientX,y:event.clientY,px:viewRef.current.panX,py:viewRef.current.panY,moved:false};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{const d=drag.current;if (!d)return;const dx=event.clientX-d.x,dy=event.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>5)d.moved=true;if(d.moved){viewRef.current.panX=d.px+dx*devicePixelRatio;viewRef.current.panY=d.py+dy*devicePixelRatio;}}} onPointerUp={event=>{const d=drag.current;drag.current=null;if(d&&!d.moved)clickMap(event);}} onPointerCancel={()=>{drag.current=null;}} />
      {!ready && <div className="po-load" role="status">{error?words.failed:words.loading}{error&&<button onClick={()=>setRetry(value=>value+1)}>{words.retry}</button>}</div>}
      <div className="po-camera"><label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>{words.labels}</label><button aria-label={words.zoomOut} onClick={()=>setZoom(value=>Math.max(.5,value-.25))}>−</button><button onClick={()=>{setZoom(1);viewRef.current.panX=0;viewRef.current.panY=0;}}>{words.fit}</button><button aria-label={words.zoomIn} onClick={()=>setZoom(value=>Math.min(3,value+.25))}>+</button></div>
    </div>
    <div className="po-footer"><a href="https://github.com/pixel-agents-hq/pixel-agents" target="_blank" rel="noreferrer">{words.source} ↗</a><span role="status">{message || (dirty?words.unsaved:"")}</span></div>
  </div>;
}
