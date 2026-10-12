import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {parsePreviewArgs,renderPreview} from './compose-social-preview.mjs';
test('preview accepts only local assets and a single PNG output',()=>{
 assert.throws(()=>parsePreviewArgs(['--image=https://example.test/image.png']),/local asset/);
 assert.throws(()=>parsePreviewArgs(['--apply']),/Unsupported/);
 assert.throws(()=>parsePreviewArgs(['--image=i.png','--headline=Hi','--primary=#ffd115','--logo-light=l.svg','--out=result.svg']),/one .png/);
});
test('local preview produces exactly one PNG with review flags when brand font is absent',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foundation-preview-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const image=join(directory,'image.png'),logo=join(directory,'logo.svg'),out=join(directory,'post.png');
 await writeFile(image,await readFile(new URL('../server/src/lib/fixtures/social/square.png',import.meta.url)));
 await writeFile(logo,'<svg xmlns="http://www.w3.org/2000/svg" width="60" height="30"><path fill="white" d="M0 0h60v30H0z"/></svg>');
 const result=await renderPreview([`--image=${image}`,`--logo-light=${logo}`,'--headline=Code renders the headline','--primary=#ffd115',`--out=${out}`]);
 assert.equal(result.status,'needs_review');assert.equal(result.font.fallback,true);assert.equal((await readFile(out)).subarray(1,4).toString(),'PNG');assert.equal(result.width,1080);
});
