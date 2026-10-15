import React from 'react';
import {outputStatus} from './task-output.js';

// Output decisions differ from generation progress. An absent status or a
// machine-finished state still requires human review.
export function OutputShelfCard({node,copy,onOpen}) {
  const status=outputStatus(node.status ?? node.state);
  const label={needs_review:copy.flagged,failed:copy.stopped,approved:copy.approved}[status];
  return <button className="ao-output-card" onClick={() => onOpen?.(node)}>
    {node.assetUrl || node.tiles?.[0] ? <img src={node.assetUrl || node.tiles[0]} alt="" loading="lazy" /> : <span className="ao-output-paper">Aa<span>——<br />——<br />—</span></span>}
    <span className="ao-output-info"><small>{label}{node.platform ? ` / ${node.platform}` : ""}</small><strong>{node.title}</strong><span>{node.specialistName || node.sub}</span></span><span>↗</span>
  </button>;
}
