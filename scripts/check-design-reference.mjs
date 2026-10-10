// Focused browser diagnostics, not a site-wide accessibility certification.
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(process.env.CAASTOR_BROWSER_MODULE_ROOT+'/package.json'),{chromium}=require('playwright');
const browser=await chromium.launch({headless:true});const results=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await page.goto('http://127.0.0.1:5184/docs/mockups/design-system/index.html');
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await page.waitForTimeout(400);
  const evidence=await page.evaluate(()=>{
   const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
   const luminance=value=>rgb(value).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
   const ratio=(fg,bg)=>{const a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
   const background=el=>{for(let node=el;node;node=node.parentElement){const bg=getComputedStyle(node).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')return bg;}return 'rgb(255, 255, 255)';};
   const samples=[['Body copy','.ds-reference header p'],['Primary action','.btn--primary'],['Field value','.ds-field input'],['Placeholder','.ds-field textarea','::placeholder']].map(([name,selector,pseudo])=>{const el=document.querySelector(selector),fg=getComputedStyle(el,pseudo).color,bg=background(el);return {name,foreground:fg,background:bg,ratio:ratio(fg,bg)};});
   for(const [name,token] of [['Canvas failure caption','--text-danger'],['Canvas running caption','--text-warning']]){
    const probe=document.createElement('span');probe.style.color=`var(${token})`;probe.style.background='var(--canvas-artifact)';document.body.append(probe);const style=getComputedStyle(probe);samples.push({name,foreground:style.color,background:style.backgroundColor,ratio:ratio(style.color,style.backgroundColor)});probe.remove();
   }
   return {samples,overflow:document.documentElement.scrollWidth>innerWidth,coarse:matchMedia('(pointer:coarse)').matches,minActionHeight:Math.min(...[...document.querySelectorAll('.ds-control')].map(el=>el.getBoundingClientRect().height))};
  });
  assert.ok(evidence.samples.every(s=>s.ratio>=4.5));assert.equal(evidence.overflow,false);assert.equal(evidence.coarse,true);assert.ok(evidence.minActionHeight>=44);results.push({theme,...evidence});
 }
 const out=new URL('../.mvp-local/browser/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('design-diagnostics.json',out),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
