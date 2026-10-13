import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {composeSocial,headlineOutlineSvg} from './compose-social.js';
import {create as createFont} from 'fontkit';
const fontBuffer=await readFile(new URL('./assets/fonts/instrument-sans.ttf',import.meta.url));
const visual={palette:[{hex:'#ffd115',role:'primary'}],type:[{kind:'Display',family:'Instrument Sans',provider:'google'}],typeScale:{h1:64}};
const mark=fill=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><path fill="${fill}" d="M5 5h40v12H17v26h28v12H5zM55 5h100v12H55zM55 25h75v12H55zM55 45h100v10H55z"/></svg>`);
const logo={light:mark('#ffffff'),dark:mark('#161616')};
const image=colour=>sharp({create:{width:1080,height:1080,channels:3,background:colour}}).png().toBuffer();
const fixtureArgs=async()=>({image:await image('#31433b'),logo,headline:'Cake made for a brighter afternoon',visual,fontBuffer});
async function pixel(buffer,x,y){return sharp(buffer).extract({left:x,top:y,width:1,height:1}).removeAlpha().raw().toBuffer();}
test('square snapshot: one PNG with real font outlines, correct logo and primary accent',async()=>{
 const output=await composeSocial(await fixtureArgs());
 assert.equal(output.mime,'image/png');assert.equal(output.width,1080);assert.equal(output.height,1080);assert.equal(output.font.fallback,false);assert.equal(output.font.family,'Instrument Sans');assert.equal(output.logoVariant,'light');assert.equal(output.status,'ready');
 assert.deepEqual([...await pixel(output.buffer,800,1076)],[255,209,21]);
 const metadata=await sharp(output.buffer).metadata();assert.equal(metadata.format,'png');
 const expected=await readFile(new URL('./fixtures/social/square.png',import.meta.url));
 const actualPixels=await sharp(output.buffer).removeAlpha().raw().toBuffer();const expectedPixels=await sharp(expected).removeAlpha().raw().toBuffer();
 assert.equal(actualPixels.length,expectedPixels.length);
 let difference=0;for(let i=0;i<actualPixels.length;i++)difference+=Math.abs(actualPixels[i]-expectedPixels[i]);
 assert.ok(difference/actualPixels.length<.6,`Snapshot pixel mean difference: ${difference/actualPixels.length}`);
});
test('light photo corner selects the dark actual logo; story export has correct dimensions',async()=>{
 const output=await composeSocial({...await fixtureArgs(),image:await image('#f5f1e4'),aspect:'9:16'});
 assert.equal(output.logoVariant,'dark');assert.equal(output.width,1080);assert.equal(output.height,1920);assert.equal((await sharp(output.buffer).metadata()).height,1920);
 assert.deepEqual([...await pixel(output.buffer,800,1916)],[255,209,21]);
});
test('missing/broken font is a flagged Instrument Sans fallback; fallback never pretends to be brand type',async()=>{
 for(const fontBuffer of [null,Buffer.from('invalid font')]){
  const output=await composeSocial({...await fixtureArgs(),fontBuffer});
  assert.equal(output.font.fallback,true);assert.equal(output.font.family,'Instrument Sans');assert.equal(output.status,'needs_review');assert.ok(output.warnings.includes('FONT_FALLBACK_INSTRUMENT_SANS'));
 }
});
test('headline is shaped into SVG paths rather than renderer font fallbacks or AI text',()=>{
 const result=headlineOutlineSvg({font:createFont(fontBuffer),text:'Café & cake',width:1080,height:1080});
 assert.match(result.svg.toString(),/<path/);assert.doesNotMatch(result.svg.toString(),/<text|font-family|Café|& cake/);
});
test('headline length, missing assets and unsupported logos are explicit',async()=>{
 const args=await fixtureArgs();
 await assert.rejects(()=>composeSocial({...args,logo:{}}),/actual SVG\/PNG/);
 await assert.rejects(()=>composeSocial({...args,visual:{}}),/primary/);
 await assert.rejects(()=>composeSocial({...args,logo:{light:Buffer.from('<svg onload="bad()"></svg>')}}),/active/);
 const output=await composeSocial({...args,headline:'One two three four five six seven eight nine ten'});assert.equal(output.headline,'One two three four five six seven eight');assert.ok(output.warnings.includes('HEADLINE_TRIMMED_TO_8_WORDS'));
});
test('supplied licensed WOFF2 Arabic font produces glyphs without fallback',async()=>{
 const arabic=await readFile(new URL('../../../public/caastor/assets/fonts/ibm-plex-sans-arabic-400.woff2',import.meta.url));
 const output=await composeSocial({...await fixtureArgs(),fontBuffer:arabic,fontFamily:'IBM Plex Sans Arabic',headline:'كعكة لنهار أجمل'});
 assert.equal(output.font.fallback,false);assert.equal(output.font.unsupportedGlyphs.length,0);
});

test('compositor rejects oversized image, logo and font before parsing',async()=>{
 const huge=Buffer.alloc(15*1024*1024+1);
 for(const inputs of [{image:huge},{image:huge,logo:{image:Buffer.from('x')}},{image:Buffer.from('x'),logo:huge},{image:Buffer.from('x'),logo:{light:huge}},{image:Buffer.from('x'),fontBuffer:huge}])await assert.rejects(()=>composeSocial(inputs),e=>e.code==='TOO_LARGE'&&e.status===413);
});
