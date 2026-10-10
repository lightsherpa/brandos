// Shared, pure graph contract. Also used by the API before persisting a document.
export const SCHEMA_VERSION = 1;
export const NODE_WIDTH = 288;
export const NODE_HEIGHT = 268;
export const TIERS = ['auto', 'premium', 'balanced', 'fast'];
export const uuid = () => globalThis.crypto.randomUUID();
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = value => typeof value === 'string' && ID.test(value);
export function outputType(node) { return node.type === 'specialist' ? node.outputType : node.type; }
export function canConnect(document, from, to) {
  if (from === to) return 'A node cannot connect to itself.';
  const source = document.nodes.find(n => n.id === from), target = document.nodes.find(n => n.id === to);
  if (!source || !target) return 'Choose two existing nodes.';
  if (target.type === 'bio' || (target.type === 'brief' && source.type !== 'bio')) return 'This input does not accept that type.';
  if (source.type === 'specialist' && target.type !== 'specialist') return 'Outputs connect to specialists.';
  if (source.outputType === 'video') return 'Video outputs do not support downstream references yet.';
  if (source.outputType === 'image' && !['image','video'].includes(target.outputType)) return 'Image references connect to image or video specialists.';
  if(source.outputType==='image'&&document.edges.some(e=>e.to===to&&document.nodes.find(n=>n.id===e.from)?.outputType==='image'))return 'Use one approved image reference per media node.';
  if (document.edges.some(e => e.from === from && e.to === to)) return 'These nodes are already connected.';
  const seen = new Set(), pending = [to];
  while (pending.length) {
    const id = pending.pop();
    if (id === from) return 'This connection would create a cycle.';
    if (seen.has(id)) continue;
    seen.add(id); document.edges.filter(e => e.from === id).forEach(e => pending.push(e.to));
  }
  return null;
}
export function validateDocument(value) {
  if (!value || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) throw new Error('Unsupported canvas document.');
  if (value.nodes.length > 200 || value.edges.length > 600) throw new Error('This canvas exceeds the supported size.');
  const ids = new Set();
  for (const n of value.nodes) {
    if (!isUuid(n.id) || ids.has(n.id)) throw new Error('Node IDs must be unique UUIDs.');
    ids.add(n.id);
    if (!['bio', 'brief', 'specialist'].includes(n.type) || !Number.isFinite(n.x) || !Number.isFinite(n.y) || Math.abs(n.x) > 100000 || Math.abs(n.y) > 100000) throw new Error('Invalid node type or position.');
    if (typeof n.title !== 'string' || n.title.length > 160) throw new Error('Node titles must be at most 160 characters.');
    if (n.type === 'specialist' && (typeof n.specialistId !== 'string' || !['text', 'image','video'].includes(n.outputType) || !TIERS.includes(n.settings?.tier))) throw new Error('Invalid specialist settings.');
    for (const key of ['pickedRunId', 'pickedOutputId']) if (n[key] != null && !isUuid(n[key])) throw new Error('Invalid selected version.');
    if (!!n.pickedRunId !== !!n.pickedOutputId) throw new Error('Choose both a run and an output.');
    if (n.settings?.revisionFeedback != null && (typeof n.settings.revisionFeedback !== 'string' || n.settings.revisionFeedback.length > 4000)) throw new Error('Revision notes must be at most 4000 characters.');
  }
  if (value.nodes.filter(n => n.type === 'bio').length !== 1 || value.nodes.filter(n => n.type === 'brief').length !== 1) throw new Error('Keep one BIO and one brief node.');
  const edges = [], edgeIds = new Set();
  for (const e of value.edges) {
    if (!isUuid(e.id) || edgeIds.has(e.id)) throw new Error('Edge IDs must be unique UUIDs.');
    edgeIds.add(e.id);
    const reason = canConnect({...value, edges}, e.from, e.to);
    if (reason) throw new Error(reason);
    const source = value.nodes.find(n => n.id === e.from);
    if (e.fromPort !== outputType(source) || e.toPort !== 'context') throw new Error('Invalid port.');
    edges.push(e);
  }
  return value;
}
export function downstream(document, id) {
  const result = new Set(), pending = [id];
  while (pending.length) {
    const current = pending.pop();
    for (const e of document.edges.filter(e => e.from === current)) {
      if (!result.has(e.to)) { result.add(e.to); pending.push(e.to); }
    }
  }
  return result;
}
export function editDocument(document, action) {
  let next = document;
  if (action.type === 'add') next = {...document, nodes: [...document.nodes, action.node], edges: [...document.edges, ...(action.edges || [])]};
  if (action.type === 'move') next = {...document, nodes: document.nodes.map(n => n.id === action.id ? {...n, x: action.x, y: action.y} : n)};
  if (action.type === 'update') {
    const stale = ('pickedOutputId' in action.patch || 'settings' in action.patch) ? downstream(document, action.id) : new Set();
    next = {...document, nodes: document.nodes.map(n => n.id === action.id ? {...n, ...action.patch} : stale.has(n.id) ? {...n, stale: true} : n)};
  }
  if (action.type === 'remove') {
    if (document.nodes.find(n => n.id === action.id)?.type !== 'specialist') return document;
    const stale = downstream(document, action.id);
    next = {...document, nodes: document.nodes.filter(n => n.id !== action.id).map(n => stale.has(n.id) ? {...n, stale: true} : n), edges: document.edges.filter(e => e.from !== action.id && e.to !== action.id)};
  }
  if (action.type === 'connect') {
    const reason = canConnect(document, action.edge.from, action.edge.to);
    if (reason) throw new Error(reason);
    next = {...document, edges: [...document.edges, action.edge], nodes: document.nodes.map(n => n.id === action.edge.to || downstream(document, action.edge.to).has(n.id) ? {...n, stale: true} : n)};
  }
  if (action.type === 'disconnect') {
    const edge = document.edges.find(e => e.id === action.id);
    const stale = downstream(document, edge?.to);
    next = {...document, edges: document.edges.filter(e => e.id !== action.id), nodes: document.nodes.map(n => n.id === edge?.to || stale.has(n.id) ? {...n, stale: true} : n)};
  }
  if (action.type === 'replace') next = action.document;
  validateDocument(next);
  return next;
}
export function historyReducer(state, action) {
  if (action.type === 'hydrate') return {document: action.document, past: [], future: []};
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return {document: state.past.at(-1), past: state.past.slice(0,-1), future: [state.document, ...state.future]};
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return {document: state.future[0], past: [...state.past, state.document], future: state.future.slice(1)};
  }
  const document = editDocument(state.document, action);
  if (document === state.document) return state;
  return {document, past: [...state.past, state.document].slice(-40), future: []};
}
export function edgeFor(document, from, to) { return {id: uuid(), from, to, fromPort: outputType(document.nodes.find(n => n.id === from)), toPort: 'context'}; }
export function pointInGraph(point, rect, viewport) { return {x: (point.x - rect.left - viewport.x) / viewport.zoom, y: (point.y - rect.top - viewport.y) / viewport.zoom}; }
export function fitViewport(nodes, width, height) {
  if (!nodes.length) return {x: 60, y: 60, zoom: 1};
  const left = Math.min(...nodes.map(n => n.x)), top = Math.min(...nodes.map(n => n.y));
  const right = Math.max(...nodes.map(n => n.x + NODE_WIDTH)), bottom = Math.max(...nodes.map(n => n.y + NODE_HEIGHT));
  const zoom = Math.max(.15, Math.min(1, (width - 96) / (right-left), (height-140) / (bottom-top)));
  return {zoom, x: (width - (right-left)*zoom)/2-left*zoom, y: (height-64-(bottom-top)*zoom)/2-top*zoom};
}
export function seedDocument({title, specialists = [], runs = []}) {
  const bioId = uuid(), briefId = uuid();
  const nodes = [{id: bioId, type: 'bio', title: 'Brand Intelligence Object', x: 32, y: 80}, {id: briefId, type: 'brief', title: (title || 'Brief').slice(0,160), x: 380, y: 80}];
  const edges = [{id: uuid(), from: bioId, to: briefId, fromPort: 'bio', toPort: 'context'}];
  for (const [index, s] of specialists.entries()) {
    const node = {id: uuid(), type: 'specialist', specialistId: s.id, outputType: s.outputType, title: s.name.slice(0,160), x: 740, y: 32+index*312, settings: {tier: 'auto', ...(s.settings || {})}};
    // Legacy runs stay explicitly identified; newly duplicated nodes never inherit them.
    const legacy = runs.filter(r => r.specialist_id === s.id && !r.canvas_node_id);
    node.legacyRunIds = legacy.map(r => r.id);
    const last = [...legacy].reverse().find(r => r.outputs?.length);
    if (last) { node.pickedRunId = last.id; node.pickedOutputId = last.outputs[0].id; }
    nodes.push(node); edges.push({id: uuid(), from: briefId, to: node.id, fromPort: 'brief', toPort: 'context'});
  }
  return validateDocument({schemaVersion: SCHEMA_VERSION, nodes, edges});
}
