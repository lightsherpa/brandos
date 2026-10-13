import {MAX_UPLOAD_BYTES} from "./ingest-guards.js";
// Code compositor, deliberately independent of all model/run/harness paths.
// Inputs are resolved asset buffers; output is exactly one PNG, never AI type.
import sharp from 'sharp';
import {create as createFont} from 'fontkit';
import {readFile} from 'node:fs/promises';
import {safeLogoSvg} from './extract-logo.js';

export const SOCIAL_SIZES=Object.freeze({'1:1':{width:1080,height:1080},'4:5':{width:1080,height:1350},'9:16':{width:1080,height:1920}});
const FALLBACK_FONT=new URL('./assets/fonts/instrument-sans.ttf',import.meta.url);
let fallbackBytes;
async function fallbackFont(){fallbackBytes ||= await readFile(FALLBACK_FONT);return createFont(fallbackBytes);}
const inputOptions={limitInputPixels:50_000_000,failOn:'error'};
const bytes=value=>Buffer.isBuffer(value)?value:value instanceof Uint8Array?Buffer.from(value):null;
const round=value=>Number(value.toFixed(3));
function runWidth(font,text,size){return font.layout(text).advanceWidth*size/font.unitsPerEm;}
function wrapHeadline(font,text,size,maxWidth){
 const lines=[];let line='';
 for(const word of text.split(/\s+/)){
  const candidate=line?`${line} ${word}`:word;
  if(line&&runWidth(font,candidate,size)>maxWidth){lines.push(line);line=word;}else line=candidate;
 }
 if(line)lines.push(line);return lines;
}
export function headlineOutlineSvg({font,text,width,height,size=64,left=43,bottom=43,maxWidth=734}){
 let actualSize=size,lines=wrapHeadline(font,text,actualSize,maxWidth);
 while(actualSize>12&&(lines.length>4||lines.some(line=>runWidth(font,line,actualSize)>maxWidth))){actualSize-=1;lines=wrapHeadline(font,text,actualSize,maxWidth);}
 const scale=actualSize/font.unitsPerEm,lineHeight=Math.ceil(actualSize*1.14);
 const ascent=font.ascent*scale,descent=Math.abs(font.descent*scale);
 const baseline=height-bottom-descent-(lines.length-1)*lineHeight;
 const groups=lines.map((line,index)=>{
  const run=font.layout(line);let pen=0;
  const glyphs=run.glyphs.map((glyph,i)=>{const position=run.positions[i];const path=glyph.path.toSVG();const x=pen+position.xOffset;pen+=position.xAdvance;return `<path transform="translate(${round(x)} ${round(position.yOffset)})" d="${path}"/>`;}).join('');
  return `<g transform="translate(${left} ${round(baseline+index*lineHeight)}) scale(${Number(scale.toFixed(8))} ${Number((-scale).toFixed(8))})">${glyphs}</g>`;
 }).join('');
 const shadeTop=Math.max(0,Math.floor(baseline-ascent-lineHeight));
 return {svg:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient></defs><rect x="0" y="${shadeTop}" width="${left+maxWidth+15}" height="${height-shadeTop}" fill="url(#shade)"/><g fill="#fff">${groups}</g></svg>`),lines,size:actualSize};
}

/** Supply a post's raw image, actual logo variants and licensed/Google font bytes.
 *  The caller resolves its pinned Brand Core assets. This function does no I/O
 *  beyond reading the bundled OFL fallback font; it has no network/model client.
 */
export async function composeSocial({image,logo,headline,visual={},fontBuffer=null,fontFamily=null,aspect='1:1'}={}){
 for(const [name,input] of [["image",image],["font",fontBuffer],...(Buffer.isBuffer(logo)||logo instanceof Uint8Array?[["logo",logo]]:Object.entries(logo || {}))]){
  if(input?.byteLength>MAX_UPLOAD_BYTES)throw Object.assign(Error(`${name} exceeds 15MB`),{code:'TOO_LARGE',status:413});
 }
 const size=SOCIAL_SIZES[aspect];if(!size)throw Error('Aspect must be 1:1, 4:5 or 9:16');
 const imageBytes=bytes(image);if(!imageBytes)throw Error('Supply the image as a resolved buffer');
 const primary=(visual.palette || []).find(colour=>colour.role==='primary'&&/^#[\da-f]{6}$/i.test(colour.hex||''));
 if(!primary)throw Error('A primary colour role is required');
 const words=String(headline || '').trim().split(/\s+/).filter(Boolean);if(!words.length||String(headline).length>500)throw Error('Supply a headline of 1–500 characters');
 const text=words.slice(0,8).join(' '),warnings=[];
 if(words.length>8)warnings.push('HEADLINE_TRIMMED_TO_8_WORDS');
 const display=(visual.type || []).find(font=>/^(display|both)$/i.test(font.kind || ''));
 const requestedFamily=fontFamily || display?.family || null;
 let font,fallback=false,fallbackReason=null;
 try{if(!bytes(fontBuffer))throw Error('Font file was not supplied');font=createFont(bytes(fontBuffer));if(!font.layout)throw Error('Font collections require a selected face');}
 catch(error){font=await fallbackFont();fallback=true;fallbackReason=error.message;warnings.push('FONT_FALLBACK_INSTRUMENT_SANS');}
 const unsupported=[...new Set([...text].filter(char=>!(/\s/.test(char))&&!font.hasGlyphForCodePoint(char.codePointAt(0))))];
 if(unsupported.length)warnings.push('FONT_MISSING_GLYPHS');
 const {width,height}=size,clear=Math.round(width*.04),logoWidth=Math.round(width*.18);
 const surface=(visual.palette || []).find(colour=>colour.role==='surface'&&/^#[\da-f]{6}$/i.test(colour.hex||''))?.hex || '#ffffff';
 const base=await sharp(imageBytes,inputOptions).rotate().resize(width,height,{fit:'cover'}).flatten({background:surface}).png().toBuffer();
 const corner=await sharp(base).extract({left:width-clear-logoWidth,top:height-clear-logoWidth-8,width:logoWidth,height:logoWidth}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 let brightness=0;
 for(let i=0;i<corner.data.length;i+=corner.info.channels)brightness+=.299*corner.data[i]+.587*corner.data[i+1]+.114*corner.data[i+2];
 brightness/=corner.info.width*corner.info.height*255;
 const preferred=brightness>.5?'dark':'light';
 const variants=bytes(logo)?{default:bytes(logo)}:logo || {};
 const chosen=bytes(variants[preferred])?preferred:bytes(variants.default)?'default':bytes(variants[preferred==='dark'?'light':'dark'])?(preferred==='dark'?'light':'dark'):null;
 if(!chosen)throw Error('Supply an actual SVG/PNG brand logo buffer');
 if(chosen!==preferred)warnings.push('LOGO_CONTRAST_VARIANT_UNAVAILABLE');
 const logoBytes=bytes(variants[chosen]);
 if(logoBytes.toString('utf8',0,200).trim().startsWith('<')&&!safeLogoSvg(logoBytes.toString('utf8')))throw Error('Logo SVG contains unsupported active or external content');
 const logoMetadata=await sharp(logoBytes,inputOptions).metadata();
 if(!['png','svg'].includes(logoMetadata.format))throw Error('Logo must be SVG or PNG');
 if(logoMetadata.format==='svg'&&!safeLogoSvg(logoBytes.toString('utf8')))throw Error('Logo SVG contains unsupported active or external content');
 const rasterLogo=await sharp(logoBytes,inputOptions).resize(logoWidth,logoWidth,{fit:'inside'}).png().toBuffer({resolveWithObject:true});
 const typeSize=Number(visual.typeScale?.h1 || 64);if(!Number.isFinite(typeSize)||typeSize<8||typeSize>200)throw Error('H1 type scale must be 8–200 px');
 const outlined=headlineOutlineSvg({font,text,width,height,size:typeSize,left:clear,bottom:clear+8,maxWidth:Math.floor(width*.69)});
 if(outlined.size!==typeSize)warnings.push('HEADLINE_SCALED_TO_FIT');
 const accent=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="8"><rect width="${width}" height="8" fill="${primary.hex}"/></svg>`);
 const buffer=await sharp(base).composite([{input:outlined.svg,top:0,left:0},{input:rasterLogo.data,left:width-clear-rasterLogo.info.width,top:height-clear-8-rasterLogo.info.height},{input:accent,left:0,top:height-8}]).png().toBuffer();
 return {buffer,mime:'image/png',width,height,headline:text,headlineLines:outlined.lines,font:{requestedFamily,family:font.familyName,fallback,fallbackReason,unsupportedGlyphs:unsupported},logoVariant:chosen,logoCornerBrightness:brightness,warnings,status:warnings.length?'needs_review':'ready'};
}
