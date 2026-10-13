import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractLogo,mergeLogoFromAssets,safeLogoSvg} from './extract-logo.js';
import {validateVisualAssetMetadata} from './ingest-guards.js';
import {classifyVisualSources} from './visual-assets.js';
const fixture = name => readFileSync(new URL(`./fixtures/logos/${name}.html`,import.meta.url),'utf8');
test('five saved HTML fixtures identify a logo or explicitly miss',()=>{
  assert.equal(extractLogo(fixture('nomad'),'https://nomad.test').url,'https://nomad.test/nomad-logo.svg');
  assert.match(extractLogo(fixture('cake-me'),'https://cakeme.test').url,/^data:image\/svg/);
  assert.equal(extractLogo(fixture('organization'),'https://brand.test').conf,90);
  assert.equal(extractLogo(fixture('icon'),'https://brand.test').conf,50);
  assert.equal(extractLogo(fixture('missing'),'https://brand.test'),null);
});
test('untrusted SVG and internal URLs are rejected',()=>{
  assert.equal(safeLogoSvg('<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10H0z"/></svg>'),true);
  assert.equal(safeLogoSvg('<svg onload="alert(1)"></svg>'),false);
  assert.equal(safeLogoSvg('<svg><defs><linearGradient id="ink"/></defs><path fill="url(#ink)"/><use href="#mark"/></svg>'),true);
  assert.equal(safeLogoSvg('<svg><use href="https://external.test/mark.svg#mark"/></svg>'),false);
  assert.equal(safeLogoSvg('<svg><path fill="url(https://external.test/paint)"/></svg>'),false);
  assert.equal(safeLogoSvg('<svg><foreignObject/></svg>'),false);
  assert.equal(extractLogo('<header><img alt="logo" src="http://127.0.0.1/logo.png"></header>','https://brand.test'),null);
});
test('uploads win, variants remain durable, logos never condition models',()=>{
  const meta=validateVisualAssetMetadata({ext:'png',assetRole:'logo',logoVariant:'dark',rightsConfirmed:true});
  assert.equal(meta.ok,true);
  const row={id:'logo-1',src:'logo.png',raw_ref:'brand/logo.png',signals:{ext:'png',...meta.metadata}};
  const classified=classifyVisualSources([row]);
  assert.equal(classified.references.length,0);
  const logo=mergeLogoFromAssets({url:'https://brand.test/icon',conf:50},classified.logos.map(x=>({...x,name:x.src})));
  assert.equal(logo.conf,100);assert.equal(logo.variants.dark.sourceId,'logo-1');assert.equal(logo.url,undefined);
  assert.equal(validateVisualAssetMetadata({ext:'jpg',assetRole:'logo',rightsConfirmed:true}).code,'LOGO_EXT');
});
