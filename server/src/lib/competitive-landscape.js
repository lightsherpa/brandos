// No research or confidence is invented at normalization time.
export function normalizePositioning(raw={}) {
 const value=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const records=(input,key)=>(Array.isArray(input)?input:[]).map(row=>typeof row==='string'?{[key]:row}:row).filter(row=>row&&typeof row==='object'&&!Array.isArray(row)&&Object.entries(row).some(([key,v])=>!['id','type'].includes(key)&&typeof v==='string'&&v.trim()));
 return {...value,frameOfReference:typeof value.frameOfReference==='string'?value.frameOfReference:'',competitors:records(value.competitors,'name'),pointsOfDifference:records(value.pointsOfDifference,'claim'),pointsOfParity:(Array.isArray(value.pointsOfParity)?value.pointsOfParity:[]).filter(v=>typeof v==='string'&&v.trim()),researchGaps:(Array.isArray(value.researchGaps)?value.researchGaps:[]).filter(v=>typeof v==='string'&&v.trim())};
}

