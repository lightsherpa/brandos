// Validate actual foundation bytes before storing a certifiable source record.
import sharp from 'sharp';
import {create as createFont} from 'fontkit';
import {SVG_UNSUPPORTED_MESSAGE} from './ingest-guards.js';
export async function foundationUploadError(buffer,ext,metadata={}){
 if(metadata.asset_role==='logo'){
  if(ext==='svg')return {code:'SVG_UNSUPPORTED',error:SVG_UNSUPPORTED_MESSAGE};
  try{
   const image=await sharp(buffer,{limitInputPixels:50_000_000,failOn:'error'}).metadata();
   if(image.format!==ext||!image.width||!image.height)throw Error('Invalid logo');
  }catch{return {code:'LOGO_INVALID',error:'The logo must contain a readable PNG image'};}
 }
 if(metadata.asset_kind==='font'){
  try{const font=createFont(buffer);if(!font.layout||!Number.isFinite(font.unitsPerEm)||!font.familyName)throw Error('Invalid font');}
  catch{return {code:'FONT_INVALID',error:'Supply a readable licensed TTF, OTF, WOFF or WOFF2 font file'};}
 }
 return null;
}
