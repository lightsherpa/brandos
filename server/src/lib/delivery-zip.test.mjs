import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryZip} from './delivery-zip.js';
import {deliveryFilename,deliveryArchiveName,attachmentHeader} from '../../../shared/delivery-filenames.js';

test('ZIP streams lazy file chunks with valid descriptors, CRC, offsets and UTF-8 names',async()=>{
 let secondStarted=false;
 const stream=deliveryZip((async function*(){
  yield {name:'Granada - Email.html',data:async function*(){yield '123';yield '456';yield '789';}};
  secondStarted=true;yield {name:'غرناطة - بريد.html',data:'email'};
 })());
 const reader=stream.getReader(),chunks=[];
 chunks.push(Buffer.from((await reader.read()).value));
 assert.equal(chunks[0].readUInt32LE(0),0x04034b50);
 assert.equal(secondStarted,false,'ZIP headers arrive before later files are prepared');
 while(true){const next=await reader.read();if(next.done)break;chunks.push(Buffer.from(next.value));}
 const zip=Buffer.concat(chunks),end=zip.length-22;
 assert.equal(zip.readUInt32LE(end),0x06054b50);assert.equal(zip.readUInt16LE(end+10),2);
 let central=zip.readUInt32LE(end+16);
 const expected=[['Granada - Email.html','123456789',0xcbf43926],['غرناطة - بريد.html','email',null]];
 for(const [name,text,crc] of expected){
  assert.equal(zip.readUInt32LE(central),0x02014b50);
  assert.equal(zip.readUInt16LE(central+8),0x0808);
  const size=zip.readUInt32LE(central+24),length=zip.readUInt16LE(central+28),local=zip.readUInt32LE(central+42);
  assert.equal(zip.subarray(central+46,central+46+length).toString(),name);
  const content=local+30+zip.readUInt16LE(local+26);
  assert.equal(zip.subarray(content,content+size).toString(),text);
  assert.equal(zip.readUInt32LE(content+size),0x08074b50);
  assert.equal(zip.readUInt32LE(content+size+4),zip.readUInt32LE(central+16));
  if(crc!==null)assert.equal(zip.readUInt32LE(central+16),crc);
  central+=46+length;
 }
});
test('stream cancellation stops preparing later entries and invokes cleanup',async()=>{
 let closed=false,later=false;
 const stream=deliveryZip((async function*(){yield {name:'Email.html',data:'hello'};later=true;yield {name:'Later.html',data:'later'};})(),{onClose:()=>{closed=true;}});
 const reader=stream.getReader();await reader.read();await reader.cancel();
 assert.equal(closed,true);assert.equal(later,false);
});
test('customer names use the brief and localized deliverable, with safe paths and Unicode headers',()=>{
 const brief={title:'Granada, primera rebanada'},piece={type:'social_post',index:0};
 assert.equal(deliveryFilename(brief,piece),'Granada primera rebanada - Social Post.html');
 assert.equal(deliveryArchiveName(brief,piece),'Granada primera rebanada - Social Post.zip');
 assert.equal(deliveryArchiveName(brief,null),'Granada primera rebanada - Delivery.zip');
 assert.match(deliveryFilename(brief,piece,'es'),/Publicación social/);
 const arabic=deliveryArchiveName({title:'غرناطة'},piece,'ar');assert.match(attachmentHeader(arabic),/filename\*=UTF-8''%/);
 assert.doesNotMatch(deliveryFilename({title:'../../x\r\n";'},piece),/[\/\\\r\n"]/);
});
