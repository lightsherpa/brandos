import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {isDraftPayload,emptyDraft} from '../shared/brief-draft-payload.js';
process.env.VITE_SUPABASE_URL||='http://127.0.0.1:54321';process.env.VITE_SUPABASE_ANON_KEY||='test';
test('Add to Brand Core is only offered for accepted work with edit permission; references explain their scope',async t=>{
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});t.after(()=>vite.close());const {AddToBrandCore,BriefPhotoReferences,briefExampleCopy}=await vite.ssrLoadModule('/src/brief-brand-examples.jsx');
 const {canAddBrandExample}=await import('../server/src/lib/brand-output-examples.js');
 const render=piece=>renderToStaticMarkup(React.createElement(AddToBrandCore,{briefId:'brief',piece}));
 assert.equal(render({status:'delivered',canAddToBrandCore:false}),'');assert.equal(render({status:'review',canAddToBrandCore:true}),'');assert.match(render({status:'delivered',canAddToBrandCore:true}),/Add to Brand Core/);
 for(const persona of ['user','workspace_admin']){const actor={persona,scope:'workspace',permissions:new Set(['bio.propose','bio.publish']),memberships:[{workspace_id:'w',status:'active'}]};assert.equal(render({status:'delivered',canAddToBrandCore:canAddBrandExample(actor,'w')}),'',`${persona} must not see Add to Brand Core`);}
 const upload=renderToStaticMarkup(React.createElement(BriefPhotoReferences,{brandId:'brand',onChange:()=>{}}));assert.match(upload,/never added to Brand Core automatically/);assert.match(upload,/type="file"/);
 for(const locale of ['es','ar'])assert.deepEqual(Object.keys(briefExampleCopy(locale)).sort(),Object.keys(briefExampleCopy('en')).sort());
 const ref={id:'11111111-1111-4111-8111-111111111111',name:'photo.png'};assert.equal(isDraftPayload({...emptyDraft(),references:[ref]}),true);assert.equal(isDraftPayload({...emptyDraft(),references:[{id:'https://other/file.png',name:'bad'}]}),false);assert.equal(isDraftPayload({...emptyDraft(),references:Array(4).fill(ref)}),false);
});
