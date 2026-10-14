import React, {useState} from 'react';
import {AgencyOffice, useOfficeCopy} from './agency-office.jsx';

export default function AgencyWorkspaceSurface({LegacyCanvas, officeScope, ...canvasProps}) {
  const copy = useOfficeCopy();
  const [surface, setSurface] = useState(() => {
    try { return localStorage.getItem('ci_workspace_surface') === 'canvas' ? 'canvas' : 'office'; }
    catch { return 'office'; }
  });
  const choose = value => {
    setSurface(value);
    try { localStorage.setItem('ci_workspace_surface', value); } catch {}
  };
  return <>
    <div className="ao-surface-switch" role="group" aria-label={copy.office}>
      <button aria-pressed={surface === 'office'} onClick={() => choose('office')}>{copy.office}</button>
      <button aria-pressed={surface === 'canvas'} onClick={() => choose('canvas')}>{copy.canvas}</button>
    </div>
    {surface === 'office'
      ? <AgencyOffice nodeData={canvasProps.nodeData} onNodeClick={canvasProps.onNodeClick} toolbarExtra={canvasProps.toolbarExtra} officeScope={officeScope || 'workspace'}/>
      : <LegacyCanvas {...canvasProps}/>}
  </>;
}
