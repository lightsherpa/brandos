import React, {lazy, Suspense} from 'react';
import {agencyOfficeEnabled} from './lib/agency-office-flag.js';
const OfficeWorkspace = agencyOfficeEnabled ? lazy(() => import('./agency-workspace-surface.jsx')) : null;

// Default-off returns the exact existing canvas with its original props.
// Office modules, styles and localStorage hooks are loaded only when enabled.
export function BriefWorkspaceSurface({LegacyCanvas, officeScope, ...canvasProps}) {
  if (!agencyOfficeEnabled) return <LegacyCanvas {...canvasProps}/>;
  return <Suspense fallback={<LegacyCanvas {...canvasProps}/>}>
    <OfficeWorkspace LegacyCanvas={LegacyCanvas} officeScope={officeScope} {...canvasProps}/>
  </Suspense>;
}
