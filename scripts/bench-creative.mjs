import { readFile,writeFile } from 'node:fs/promises';
import { summarizeBenchmark,evaluateJevLabels } from '../server/src/lib/creative/benchmark.js';
const briefs=JSON.parse(await readFile(new URL('./fixtures/creative-briefs.json',import.meta.url)));
const labels=JSON.parse(await readFile(new URL('./fixtures/jev-labeled-cases.json',import.meta.url)));
const file=process.argv.find(a=>a.startsWith('--results='))?.slice(10);
const results=file?JSON.parse(await readFile(file,'utf8')):{creative:[],jev:[]};
const report={fixtureCounts:Object.fromEntries(['image','video','email'].map(m=>[m,briefs.filter(b=>b.modality===m).length])),
  comparisons:summarizeBenchmark(results.creative||[]),jev:evaluateJevLabels(labels,results.jev||[]),
  status:file?'Measured records supplied; review evidence before qualification':'Offline fixtures validated; no model evaluations performed',
  comparisonPolicy:'Gateway comparisons require identical model version and settings. Cross-model results remain separate. Include cache mode, fees, failures, revisions and total time/cost to accepted output.'};
if(process.argv.includes('--paid'))throw new Error('Use the controlled media benchmark runner with an explicit budget and qualified endpoint configuration. This reporting command never makes paid calls.');
if(briefs.length!==30||labels.length<100)throw new Error('Incomplete fixture corpus');
console.log(JSON.stringify(report,null,2));
