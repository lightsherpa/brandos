#!/usr/bin/env node
// Offline approval preparation only. No client, credentials, network or apply mode.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {payloadHash} from '../server/src/lib/bio-hash.js';
import {foundationStatus} from '../server/src/lib/brand-foundation.js';
import {scoreBio} from '../server/src/lib/score-bio.js';
export function prepareCakeMeFoundation(snapshot){
 const brand=snapshot?.brand;const bios=Array.isArray(snapshot?.bios)?snapshot.bios:[];
 const bio=[...bios].sort((a,b)=>b.version-a.version)[0];
 if(!brand?.id || !/^cake[\s-]?me$/i.test(brand.name || '') || !bio?.payload)throw Error('A saved Cake Me brand/BIO snapshot is required');
 const sources=(snapshot.bio_sources || []).filter(row=>row.kind==='file_upload'&&row.bucket==='visual'&&!row.signals?.asset_role&&/\.(png|jpe?g|webp)$/i.test(row.src||''));
 const palette=bio.payload.visual?.palette || [];
 const primary=palette.find(colour=>colour.hex?.toLowerCase()==='#ffd115');
 return {
  kind:'cake_me_foundation_approval',approvalRequired:'Oscar',approved:false,preparedOnly:true,executable:false,
  target:{brandId:brand.id,brandName:brand.name,bioId:bio.id,version:bio.version,payloadHash:payloadHash(bio.payload)},
  current:{storedScore:bio.score,displayedScore:scoreBio(bio.payload),...foundationStatus(bio.payload)},
  proposals:{primaryColour:primary?{hex:primary.hex,role:'primary',status:'requires_designer_confirmation'}:null,referenceSources:sources.map(row=>({sourceId:row.id,name:row.src,assetRole:'canonical',rightsConfirmed:true,status:'requires_Oscar_rights_approval'}))},
  requiredBeforeLoad:[
   'Supply the official light and dark logo files (no synthetic fixture assets).',
   'Confirm primary/ink/surface/accent roles against the brand guide.',
   'Choose the actual display and body Google Fonts or upload licensed binaries and licence reference.',
   'Confirm rights for the three existing reference images.',
   'Review a concrete final payload diff against the pinned version/hash before approving any production load.',
  ],
  plannedActions:[
   'Upload approved brand assets using the existing UI, retaining durable source IDs.',
   'Create an uncertified append-only Brand Core version with approved roles, fonts and references.',
   'Re-check score and missing foundation fields; certify through the normal review flow.',
   'After approval and pipeline integration, capture two social posts and one email as before/after proof.',
  ],
  constraints:{productionWrites:false,seed:false,modelCalls:0,testAssetsExcluded:true,backfillScriptLocalOnly:true},
 };
}
export async function prepareFromFiles(args){
 const values={};for(const arg of args){const match=arg.match(/^--(snapshot|out)=(.+)$/);if(!match)throw Error(`Unsupported argument: ${arg}`);values[match[1]]=match[2];}
 if(!values.snapshot||!values.out)throw Error('Use --snapshot=<local JSON> --out=<local approval JSON>');
 const packet=prepareCakeMeFoundation(JSON.parse(await readFile(values.snapshot,'utf8')));
 await writeFile(values.out,JSON.stringify(packet,null,2)+'\n');return packet;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)prepareFromFiles(process.argv.slice(2)).then(packet=>console.log(`Prepared only: ${packet.proposals.referenceSources.length} reference proposals; approval required.`)).catch(error=>{console.error(error.message);process.exitCode=1;});
