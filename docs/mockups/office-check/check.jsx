// Explicit synthetic harness; production components, no API or run requests.
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {initI18n,setLocale} from '../../../src/lib/i18n.js';
import '../../../src/portal-data.js';import {OfficePreview} from '../../../src/agency-office.jsx';
initI18n();
function Check(){const [scale,setScale]=useState(1);return <><nav className="test-controls" aria-label="Test controls"><strong>Synthetic office test</strong>{['light','dark'].map(theme=><button key={theme} onClick={()=>document.documentElement.dataset.theme=theme}>{theme}</button>)}{['en','es','ar'].map(locale=><button key={locale} onClick={()=>setLocale(locale)}>{locale}</button>)}<button onClick={()=>setScale(scale===1?2:1)}>Text scale {scale*100}%</button></nav><main style={{zoom:scale}}><OfficePreview officeScope="accessibility-test-only"/></main></>}
createRoot(document.getElementById('root')).render(<Check/>);
