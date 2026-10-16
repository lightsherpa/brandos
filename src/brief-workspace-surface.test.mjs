import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';

async function loadSurface(flag) {
  const result = await build({
    entryPoints: [new URL('./brief-workspace-surface.jsx', import.meta.url).pathname],
    bundle: true, write: false, format: 'esm', platform: 'node',
    external: ['react'], define: {'__AGENCY_OFFICE__': String(flag)},
    plugins: [{name: 'office-load-guard', setup(builder) {
      builder.onResolve({filter: /agency-workspace-surface\.jsx$/}, () => ({path: 'office-guard', namespace: 'guard'}));
      builder.onLoad({filter: /.*/, namespace: 'guard'}, () => ({contents: 'throw new Error("Office must not load when the flag is off"); export default function Office() {}', loader: 'js'}));
    }}],
  });
  // A file URL keeps React resolvable from this checkout, without leaving test build output.
  const {writeFile, unlink} = await import('node:fs/promises');
  const path = new URL(`./.office-render-test-${crypto.randomUUID()}.mjs`, import.meta.url);
  await writeFile(path, result.outputFiles[0].text);
  try { return await import(path.href); } finally { await unlink(path); }
}
const {BriefWorkspaceSurface} = await loadSurface(false);
for (const mode of ['live-run', 'saved-brief']) {
  test(`AGENCY_OFFICE off renders the unchanged ${mode} legacy canvas`, () => {
    const nodeData = [{id: 'brief', title: mode}], edges = [{from: 'brief', to: 'agent'}];
    const onNodeClick = () => {}, renderNode = () => {}, toolbarExtra = React.createElement('button', null, 'Existing action');
    const props = {nodeData, edges, onNodeClick, renderNode, toolbarExtra, helper: 'Existing helper', exportName: mode};
    let received;
    function LegacyCanvas(actual) {
      received = actual;
      return React.createElement('section', {'data-export': actual.exportName}, actual.toolbarExtra, actual.nodeData[0].title, actual.helper);
    }
    const expected = renderToStaticMarkup(React.createElement(LegacyCanvas, props));
    const rendered = renderToStaticMarkup(React.createElement(BriefWorkspaceSurface, {...props, LegacyCanvas, officeScope: 'brand-id'}));
    assert.equal(rendered, expected);
    assert.deepEqual(received, props);
    assert.equal(received.onNodeClick, onNodeClick);
    assert.equal(received.nodeData, nodeData);
    assert.doesNotMatch(rendered, /Agency office|Customize office/);
  });
}
test('default flag is off without a build-time definition', async () => {
  const {agencyOfficeEnabled} = await import('./lib/agency-office-flag.js');
  assert.equal(agencyOfficeEnabled, false);
});
test('live and saved delivery views use grouped cards; dev prototype stays intact', async () => {
  const source = await readFile(new URL('./portal-briefs.jsx', import.meta.url), 'utf8');
  assert.match(source, /return <LiveDeliveryCanvas/);
  assert.match(source, /return <SavedDeliveryCanvas/);
  assert.match(source, /if \(prototype && canInspectDelivery\(session\)\) return <PlexCanvasPrototype go=\{go\} \/>;/);
  assert.match(source, /taskOutput\.savedBriefGuidance/);
  assert.doesNotMatch(source, /OfficePreview/);
});
