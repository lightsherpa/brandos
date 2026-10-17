import React from 'react';
import {useLocale} from './lib/i18n.js';
export const canvasNavigationCopy=locale=>({
 en:{backCanvas:'Back to Canvas',backBrief:'Back to brief',pin:'Pin menu',unpin:'Unpin menu',menu:'Menu',path:'Canvas path',canvas:'Canvas',brief:'Brief'},
 es:{backCanvas:'Volver al Canvas',backBrief:'Volver al brief',pin:'Fijar menú',unpin:'Desfijar menú',menu:'Menú',path:'Ruta del Canvas',canvas:'Canvas',brief:'Brief'},
 ar:{backCanvas:'العودة إلى لوحة العمل',backBrief:'العودة إلى الموجز',pin:'تثبيت القائمة',unpin:'إلغاء تثبيت القائمة',menu:'القائمة',path:'مسار لوحة العمل',canvas:'لوحة العمل',brief:'الموجز'},
}[locale]||canvasNavigationCopy('en'));
export function CanvasNavigation({briefName,deliverableName,onCanvas,onBrief}) {
 const {locale}=useLocale(),c=canvasNavigationCopy(locale);
 return <nav className="canvas-path" aria-label={c.path} dir={locale==='ar'?'rtl':'ltr'}>
  <button className="btn btn--ghost canvas-path__back" onClick={deliverableName?onCanvas:onBrief}><span aria-hidden="true">{locale==='ar'?'→':'←'}</span> {deliverableName?c.backCanvas:c.backBrief}</button>
  <ol><li><button onClick={onCanvas}>{c.canvas}</button></li><li><span aria-hidden="true">→</span><button title={briefName||c.brief} onClick={onBrief}>{briefName||c.brief}</button></li>{deliverableName&&<li><span aria-hidden="true">→</span><button aria-current="page" onClick={event=>event.currentTarget.closest('.gd-detail')?.focus()}>{deliverableName}</button></li>}</ol>
 </nav>;
}
export const canvasPinKey=userId=>userId?`brandos:canvas-menu:${userId}`:null;
export function readCanvasPin(storage,userId) {try{return !!userId&&storage?.getItem(canvasPinKey(userId))==='pinned';}catch{return false;}}
export function writeCanvasPin(storage,userId,pinned) {try{if(userId)storage?.setItem(canvasPinKey(userId),pinned?'pinned':'rail');}catch{/* Browser storage may be unavailable. */}}
