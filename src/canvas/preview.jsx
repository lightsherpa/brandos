// Development interaction fixture. Not imported by the production application.
import React from 'react';
import {initI18n,setLocale,t} from '../lib/i18n.js';
initI18n();
import {createRoot} from 'react-dom/client';
import '../portal-data.js';
import '../portal-shared.jsx';
import {CanvasProvider} from './CanvasProvider.jsx';
import {CanvasWorkspace} from './CanvasWorkspace.jsx';
import {seedDocument} from './document.js';
import './canvas.css';
import {installPreviewDemo} from './preview-demo.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const document=seedDocument({title:'Night serum launch',specialists:[{id:'a01',name:'Positioning Architect',outputType:'text'},{id:'a16',name:'Social Captions',outputType:'text'},{id:'a20',name:'Hero KV',outputType:'image'}]});
const initial={canvas:{id:id(1),brand_id:id(2),brief_id:id(3),revision:0,document},brief:{id:id(3),title:'Night serum launch',payload:{request:'Introduce a night serum through a launch campaign that balances clinical proof with a daily ritual.',tension:'Clinical proof and the comfort of a daily ritual',refusals:['Avoid unsupported medical claims.']}},bio:{version:3,cert_kind:'steward',certified:true},permissions:['brief.read','brief.write','brief.run','output.read','output.write','output.client_approve'],userId:id(4),specialists:[{id:'a01',name:'Positioning Architect',outputType:'text'},{id:'a16',name:'Social Captions',outputType:'text'},{id:'a20',name:'Hero KV',outputType:'image'}]};
if(import.meta.env.DEV){window.__canvasLocale={setLocale,t};if(new URLSearchParams(location.search).has('demo')){const reset=installPreviewDemo(initial);const banner=globalThis.document.createElement('div');banner.style.cssText='height:32px;box-sizing:border-box;padding:6px 16px;font:12px var(--font-ui);background:var(--c-surface);color:var(--c-ink);border-bottom:1px solid var(--c-line);display:flex;justify-content:space-between';banner.textContent='Local sandbox · simulated responses and credits · edits saved in this browser';const button=globalThis.document.createElement('button');button.textContent='Reset demo';button.onclick=reset;banner.appendChild(button);globalThis.document.body.prepend(banner);globalThis.document.getElementById('app').style.height='calc(100% - 32px)';}window.__canvasFixture=initial;createRoot(globalThis.document.getElementById('app')).render(<CanvasProvider initial={initial}><CanvasWorkspace onBack={()=>{}} go={()=>{}}/></CanvasProvider>);}
