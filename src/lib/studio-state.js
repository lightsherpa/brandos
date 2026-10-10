// Presentation events only. A handoff must have an explicit source in real run data.
export function spriteFrame(action, tick) {
  const cycle = Math.abs(Math.floor(tick));
  return action === 'walk' ? cycle % 3 : action === 'work' ? 3 + cycle % 2 : 0;
}
export function spriteOffset(action, tick, scale = 2.25) {
  return -spriteFrame(action, tick) * 16 * scale;
}
export function studioEvents(previous, crew) {
  if (!previous) return [];
  return crew.flatMap(agent => {
    const id = agent.node.id, state = agent.state;
    if (previous.get(id) === state) return [];
    if (state === 'running') return [{ from: agent.node.inputFrom || 'brandolph', to: id, kind: agent.node.inputFrom ? 'handoff' : 'assignment' }];
    if (['done', 'flagged'].includes(state) && previous.get(id) === 'running') return [{from:id,to:'gallery',kind:'delivery'}];
    return [];
  });
}
// Standing concepts belong beside workstations until seated sprites exist.
const spots={strategy:[34,39],concept:[69,39],copy:[34,66],visual:[69,66],web:[58,78],review:[80,29]};
export function studioPosition(agent, peers) {
 const base=spots[agent.room]||spots.strategy;
 const index=peers.filter(item=>item.room===agent.room).findIndex(item=>item.node.id===agent.node.id);
 return [Math.min(92,base[0]+(index%3)*7),Math.min(70,base[1]+Math.floor(index/3)*8)];
}
