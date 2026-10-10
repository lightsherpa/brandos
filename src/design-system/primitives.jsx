import React,{useEffect,useRef,useId} from 'react';
import {createPortal} from 'react-dom';
import './primitives.css';
import {t,useLocale} from '../lib/i18n.js';
const Icon=props=>window.Icon?<window.Icon {...props}/>:null;
export function Dialog({label,onClose,children,compact=false,wide=false,restoreFocusTo=null}) {
  useLocale();
  const ref=useRef(null),id=useId(),closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{
    const previous=restoreFocusTo||document.activeElement;
    const background=document.getElementById('app'),oldInert=background?.inert;
    if(background)background.inert=true;
    const focusable=()=>[...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,select,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);
    (focusable()[0]||ref.current).focus();
    const key=e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeRef.current();}
      if(e.key==='Tab'){
        const items=focusable();if(!items.length){e.preventDefault();return;}
        const first=items[0],last=items.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    };
    ref.current.addEventListener('keydown',key);
    return()=>{if(background)background.inert=oldInert;queueMicrotask(()=>previous?.isConnected&&previous?.focus?.());};
  },[]);
  return createPortal(<div className="cvs-dialog-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} className={`cvs-dialog${compact?' cvs-dialog-compact':''}${wide?' cvs-dialog-wide':''}`}><header><h2 id={id}>{label}</h2><button className="cvs-icon-button" aria-label={t("common.close")} onClick={onClose}><Icon name="close" size={16}/></button></header>{children}</section></div>,document.body);
}
export function PanelHeader({title,onClose}) {useLocale();return <header className="cvs-panel-header"><h2>{title}</h2><button className="cvs-icon-button" aria-label={t("common.closePanel")} onClick={onClose}><Icon name="close" size={16}/></button></header>;}

export function IconButton({icon,label,...props}){return <button type="button" title={label} aria-label={label} {...props}>{icon&&<Icon name={icon} size={15}/>}</button>;}
export function ActionButton({variant='ghost',className='',...props}){return <button type="button" className={`btn btn--${variant} ds-control ${className}`} {...props}/>;}
