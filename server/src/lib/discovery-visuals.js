import {extractLogo} from "./extract-logo.js";
import {resolveVisualStyles} from './discovery-styles.js';

// Each reference stays separate: inspiration never becomes the brand's palette.
export async function collectDiscoveryVisuals({url,references=[],scrape,readImagery,readStyles,assets={references:[],fonts:[]},telemetry={}}) {
  const sources=[];
  const targets=[...(url?[{url,purpose:'current',note:''}]:[]),...references.filter(row=>row.purpose!=='competitive')];
  for (const target of targets) {
    const entry={...target,checkedAt:new Date().toISOString(),status:'unreadable',visual:{palette:[],type:[],imagery:[],avoid:[]},limitations:[]};
    try {
      const page=await scrape(target.url,{formats:['rawHtml','screenshot'],onlyMainContent:false,telemetry});
      entry.visual.logo=extractLogo(page.rawHtml||"",target.url);
      const styles=await resolveVisualStyles({html:page.rawHtml||'',url:target.url,...(readStyles?{read:readStyles}:{})});
      entry.visual.palette=styles.palette;entry.visual.type=styles.type;entry.visual.contrastPairs=styles.contrastPairs;entry.styles=styles;
      if(styles.unreadableStylesheets.length)entry.limitations.push('Some linked stylesheets could not be read.');
      entry.status=page.rawHtml?'partial':'unreadable';
      if(page.screenshot){
        const observed=await readImagery({screenshotUrl:page.screenshot,telemetry});
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
  for(const purpose of ['current','aspiration']){
    const refs=assets.references.filter(ref=>(ref.signals?.purpose==='aspiration'||ref.role==='inspiration'?'aspiration':'current')===purpose);
    if(!refs.length)continue;
    const observed=await readImagery({referenceImages:refs,telemetry});
    sources.push({url:null,purpose,kind:'uploaded_images',status:observed.imagery?.length?'partial':'unreadable',checkedAt:new Date().toISOString(),sourceIds:refs.map(r=>r.id),visual:{palette:[],type:[],imagery:observed.imagery||[],avoid:observed.avoid||[]},references:refs.map(({id,name,role})=>({sourceId:id,name,role})),limitations:observed.limitations||[]});
  }
  return {sources,limitations:['Palette and typography are source declarations, not verified computed styles. Palette roles are inferred and require review.','Screenshots and uploaded images provide model observations; these are not a certified photographic style guide.','PDF text is read, but embedded PDF images are not rendered or inspected.']};
}
