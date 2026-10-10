import {pickedVersion,outputText,outputImages,statusCode,statusLabel,workflowLabel} from './view-model.js';
// Read-only projection of the authoritative canvas document and selected run/output.
// Office identifiers always carry the real canvas node ID for the shared handlers.
export function canvasOfficeNodes(document, runs=[], busy={}, brief={}) {
  const nodes=document.nodes.map(node=>{
    const code=statusCode(node,runs,busy[node.id]);
    const states={ready:'done',approved:'done',not_run:'queued',source:'done',brief:'done',stale:'flagged'};
    const source=document.edges.find(edge=>edge.to===node.id && document.nodes.some(n=>n.id===edge.from && n.type==='specialist'));
    return {id:node.id,canvasNodeId:node.id,kind:node.type,specId:node.specialistId,title:node.title,
      state:states[code]||code,inputFrom:source?.from,
      sub:node.type==='brief'?(brief.payload?.sharpenedBrief||brief.payload?.request||brief.title):statusLabel(node,runs,busy[node.id])};
  });
  for (const node of document.nodes.filter(n=>n.type==='specialist')) {
    const {output}=pickedVersion(node,runs);
    if(!output)continue;
    nodes.push({id:node.id+'-d'+output.id,canvasNodeId:node.id,outputId:output.id,kind:'deliverable',
      title:output.title||node.title,body:outputText(output),mediaType:output.kind==='video'||node.outputType==='video'?'video':node.outputType==='image'?'image':'text',
      assetUrl:output.kind==='video'||node.outputType==='video'?undefined:outputImages(output)[0],
      workflowStatus:output.workflow_status||'draft',workflowLabel:workflowLabel(output.workflow_status||'draft'),
      reviewNote:node.stale?statusLabel(node,runs,busy[node.id]):output.status==='flagged'?'QA flagged':undefined,
      status:output.status==='flagged'||node.stale?'flagged':output.workflow_status?.includes('approved')?'approved':'pending',
      specialistName:node.title,platform:output.platform});
  }
  return nodes;
}
