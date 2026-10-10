// Only these server codes prove rejection before a quote claim/execution.
// HTTP status alone cannot prove that a provider submission never happened.
export function afterSubmissionError(busy,nodeId,quoteId,error,accepted=false) {
 const next={...busy};
 if(!accepted&&['QUOTE_CHANGED','QUOTE_REQUIRED'].includes(error.code)) delete next[nodeId];
 else next[nodeId]={phase:'reconciling',runId:quoteId};
 return next;
}
