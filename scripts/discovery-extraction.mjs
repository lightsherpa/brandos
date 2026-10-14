// Read-only deterministic rerun. No database connection or paid model calls.
import {readFile} from 'node:fs/promises';
import {collectDiscoveryVisuals} from '../server/src/lib/discovery-visuals.js';
import {readPublicStylesheet} from '../server/src/lib/discovery-styles.js';
import {inspectPublicLogo} from '../server/src/lib/discovered-logo.js';
import {scoreBioBreakdown} from '../server/src/lib/score-bio.js';
const url='https://www.lamasbonita.es';
const started=performance.now();
const evidence=await collectDiscoveryVisuals({url,scrape:async target=>({rawHtml:await readPublicStylesheet(target,0,/text\/html/i)}),readImagery:async()=>({imagery:[],avoid:[]})});
const visual=evidence.sources[0].visual;
let score=null;
if(process.argv[2]){
 const baseline=JSON.parse(await readFile(process.argv[2],'utf8'));
 const bio=baseline.data?.bio||baseline.bio||baseline;
 // Existing recorded claim confidence stays unchanged. This does not synthesize
 // new textual claims and is not a newly persisted production BIO.
 score={recordedScore:bio.score,rerun:scoreBioBreakdown({...bio.payload,visual},{logoRights:[]})};
}
console.log(JSON.stringify({url,checkedAt:new Date().toISOString(),mode:'read-only deterministic extraction',paidCostUsd:0,elapsedSeconds:Number(((performance.now()-started)/1000).toFixed(2)),visual,logoDimensions:visual.logo?await inspectPublicLogo(visual.logo.url):null,styles:evidence.sources[0].styles,limitations:evidence.sources[0].limitations,score},null,2));
