// Runs in Firecrawl's browser after page rendering. getComputedStyle resolves
// custom properties, inheritance and the cascade on elements actually in use.
export const COMPUTED_STYLE_SCRIPT = `(() => {
 const samples=[];
 const groups=[['logo','header svg, nav svg, header img, nav img, [class*="logo"] svg, [class*="logo"] img'],['header','header,nav,.topbar,[role="banner"]'],['button','button,[role="button"],a[class*="btn"],a[class*="button"],input[type="submit"]'],['background','body,main,section'],['display','h1,h2,h3'],['body','p,li']];
 for(const [kind,selector] of groups){
  for(const el of [...document.querySelectorAll(selector)].slice(0,40)){
   const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
   if(!rect.width||!rect.height||style.visibility==='hidden'||style.display==='none')continue;
   const colors=kind==='logo'&&el.tagName==='IMG'?[]:[style.color,style.backgroundColor];
   if(kind==='logo')for(const node of [el,...el.querySelectorAll('path,rect,circle,text,use')].slice(0,80)){const s=getComputedStyle(node);colors.push(s.fill,s.stroke);}
   samples.push({kind,colors,fontFamily:style.fontFamily,area:rect.width*rect.height});
  }
 }
 return JSON.stringify({samples});
})()`;

export function computedStyleSamples(page) {
 for(const item of page?.actions?.javascriptReturns || []){
  try{
   const raw=item.value ?? item;
   const result=typeof raw==='string'?JSON.parse(raw):raw;
   if(Array.isArray(result?.samples))return result.samples.slice(0,240);
  }catch{ /* unavailable computed evidence is not a font or palette */ }
 }
 return [];
}
