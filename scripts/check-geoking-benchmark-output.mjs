import {readFile,writeFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {BIO_FIELDS} from '../server/src/lib/bio-schema.js';
const root=new URL('../output/discovery-bio/geoking-comparison/',import.meta.url);
const report=JSON.parse(await readFile(new URL('comparison.json',root)));
globalThis.window={CI_USER:{name:'Benchmark'},matchMedia:()=>({matches:true})};
const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
const checks=[];
try{
 const {BioCompetitive}=await vite.ssrLoadModule('/src/bio-competitive.jsx');
 for(const run of report.runs){
  if(run.status!=='completed')continue;
  const bio=JSON.parse(await readFile(new URL(run.model.split('/')[1]+'/bio.json',root)));
  const result={model:run.model,missingRegisteredFields:[],invalidFieldTypes:[],competitiveRenderer:'passed'};
  for(const field of BIO_FIELDS){const value=bio?.[field.path[0]]?.[field.path[1]];const name=field.path.join('.');if(value===undefined)result.missingRegisteredFields.push(name);else if(value!==null&&(field.kind==='scalar'?typeof value!=='string':!Array.isArray(value)))result.invalidFieldTypes.push(name);}
  try{renderToStaticMarkup(React.createElement(BioCompetitive,{value:bio.positioning,editing:false}));}
  catch(error){result.competitiveRenderer='failed';result.renderError=error.message;}
  checks.push(result);
 }
}finally{await vite.close();delete globalThis.window;}
await writeFile(new URL('output-checks.json',root),JSON.stringify(checks,null,2)+'\n');
console.log(JSON.stringify(checks,null,2));
