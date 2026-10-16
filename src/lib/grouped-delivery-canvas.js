// Only the terminal outputs change. Brand Core, Brief and the existing canvas
// retain their identity so polling and opening a preview never reset positions.
export function groupedDeliveryGraph(brief, deliverables, copy) {
  const rowHeight = 266;
  const middle = Math.max(0, (deliverables.length - 1) * rowHeight / 2);
  const nodes = [
    {id:'bio', kind:'bio', x:20, y:middle, w:210, title:'Brand Core'},
    {id:'brief', kind:'brief', x:290, y:middle, w:230, title:brief.title || copy.brief},
    ...deliverables.map((piece,index) => ({id:piece.id, kind:'delivery', x:590, y:20 + index*rowHeight, w:260, piece})),
    {id:'delivery', kind:'delivery', x:920, y:middle, w:210, title:copy.delivery},
  ];
  const edge = (from,to) => ({from,to,fromSide:'right',toSide:'left'});
  return {nodes, edges:[edge('bio','brief'), ...deliverables.flatMap(piece => [edge('brief',piece.id),edge(piece.id,'delivery')])]};
}
