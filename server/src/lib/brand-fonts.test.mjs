import {test} from 'node:test';
import assert from 'node:assert/strict';
import {usableDisplayFont,googleFontCssUrl,validateFoundationVisual} from './brand-foundation.js';
import {mergeTypographyFromAssets} from './visual-assets.js';
test('only a selected Google Font or licensed upload supplies usable display type',()=>{
 assert.equal(usableDisplayFont({kind:'Display',family:'Invented'}),false);
 assert.equal(usableDisplayFont({kind:'Display',family:'Instrument Sans',provider:'fallback'}),false);
 assert.equal(usableDisplayFont({kind:'Display',family:'Inter',provider:'google'}),true);
 const font=mergeTypographyFromAssets([],[{id:'font',signals:{font_family:'Brand Sans',font_usage:'Both',license_type:'commercial'}}])[0];
 assert.equal(usableDisplayFont(font),true);
 assert.equal(usableDisplayFont({...font,kind:'Body'}),false);
 assert.equal(googleFontCssUrl('DM Sans'),'https://fonts.googleapis.com/css2?family=DM+Sans&display=swap');
});
test('font provider and pixel scale validation reject invalid settings',()=>{
 assert.match(validateFoundationVisual({type:[{kind:'Display',family:'Fake',provider:'google'}]}),/supported/);
 assert.match(validateFoundationVisual({typeScale:{h1:300}}),/8–200/);
 assert.equal(validateFoundationVisual({typeScale:{h1:64,h2:48,body:16}}),null);
});
