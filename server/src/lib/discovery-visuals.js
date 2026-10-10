import {extractPalette,extractFonts} from './extract-visual-deterministic.js';

// Each reference stays separate: inspiration never becomes the brand's palette.
export async function collectDiscoveryVisuals({url,references=[],scrape,readImagery}) {
  const sources=[];
  const targets=[...(url?[{url,purpose:'current',note:''}]:[]),...references.filter(row=>row.purpose!=='competitive')];
  for (const target of targets) {
    const entry={...target,checkedAt:new Date().toISOString(),status:'unreadable',visual:{palette:[],type:[],imagery:[],avoid:[]},limitations:[]};
    try {
      const page=await scrape(target.url,{formats:['rawHtml','screenshot'],onlyMainContent:false});
      entry.visual.palette=extractPalette(page.rawHtml||'');
      entry.visual.type=extractFonts(page.rawHtml||'');
      entry.status=page.rawHtml?'partial':'unreadable';
      if(page.screenshot){
        const observed=await readImagery({screenshotUrl:page.screenshot});
        entry.visual.imagery=(observed.imagery||[]).filter(x=>typeof x==='string');
        // Avoid is a recommendation, not a deterministic observed fact.
        entry.visual.avoid=(observed.avoid||[]).filter(x=>typeof x==='string');
        entry.screenshotUrl=page.screenshot;
        if(!entry.visual.imagery.length)entry.limitations.push('Screenshot available but imagery interpretation returned no observations.');
      }else entry.limitations.push('No screenshot available; photographic style was not inspected.');
      if(!entry.visual.palette.length)entry.limitations.push('No supported color declarations extracted.');
      if(!entry.visual.type.length)entry.limitations.push('No supported font declarations extracted.');
    }catch {entry.limitations.push('Visual source request failed; no visual evidence inferred.');}
    sources.push(entry);
  }
  return {sources,limitations:['Palette and typography are HTML declarations, not verified computed styles or downloaded font files.','Screenshots can contain illustrations or UI; descriptions are model observations, not a verified photographic style guide.','Image uploads and document visuals are not analyzed by this test route.']};
}
