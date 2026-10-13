#!/usr/bin/env node
// Local-file compositor preview. No network, model, Storage or ledger writes.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {composeSocial} from '../server/src/lib/compose-social.js';
export function parsePreviewArgs(args){
 const options={aspect:'1:1'};const supported=new Set(['image','logo-light','logo-dark','font','font-family','headline','primary','aspect','out']);
 for(const arg of args){const match=arg.match(/^--([\w-]+)=(.+)$/s);if(!match||!supported.has(match[1]))throw Error(`Unsupported argument: ${arg}`);if(/^https?:\/\//i.test(match[2])&&['image','logo-light','logo-dark','font'].includes(match[1]))throw Error('Use local asset files, not network URLs');options[match[1]]=match[2];}
 for(const key of ['image','headline','primary','out'])if(!options[key])throw Error(`Required: --${key}=...`);
 if(!options['logo-light']&&!options['logo-dark'])throw Error('Supply at least one --logo-light or --logo-dark');
 if(!/\.png$/i.test(options.out))throw Error('Output must be one .png file');
 return options;
}
export async function renderPreview(args){
 const options=parsePreviewArgs(args),logo={};
 for(const variant of ['light','dark'])if(options[`logo-${variant}`])logo[variant]=await readFile(options[`logo-${variant}`]);
 const output=await composeSocial({image:await readFile(options.image),logo,headline:options.headline,aspect:options.aspect,fontBuffer:options.font?await readFile(options.font):null,fontFamily:options['font-family']||null,visual:{palette:[{hex:options.primary,role:'primary'}],type:options['font-family']?[{kind:'Display',family:options['font-family']}]:[]}});
 await writeFile(options.out,output.buffer);
 return {...output,buffer:undefined,outputPath:options.out};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)renderPreview(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
