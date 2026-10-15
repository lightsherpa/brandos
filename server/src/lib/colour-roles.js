// Roles remain proposals requiring human review. Evidence comes from page use,
// never from a model's guess or saturation alone.
export function assignEvidenceColourRoles(palette) {
 const channels=c=>c.hex.slice(1).match(/../g).map(v=>parseInt(v,16));
 const chromatic=c=>{const rgb=channels(c);return Math.max(...rgb)-Math.min(...rgb)>=24;};
 const primary=palette.filter(c=>chromatic(c)&&c.brandWeight>0).sort((a,b)=>b.brandWeight-a.brandWeight)[0];
 const seen=new Set();
 return palette.map(c=>{
  const rgb=channels(c);
  let role=c===primary?'primary':!chromatic(c)?Math.max(...rgb)<128?'ink':Math.min(...rgb)>220?'surface':'accent':'accent';
  if(['primary','ink','surface'].includes(role)){if(seen.has(role))role='accent';else seen.add(role);}
  return {...c,role,roleStatus:'inferred'};
 });
}
