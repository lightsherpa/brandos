// Stored ZIP entries with data descriptors: content and CRC are emitted as they
// arrive. Only the small central-directory metadata remains in memory.
const CRC_TABLE=Uint32Array.from({length:256},(_,value)=>{for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);return value>>>0;});
async function* zipChunks(files) {
 const central=[];let offset=0;
 for await(const file of files){
  if(!/^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,180}\.(html|txt|json)$/u.test(file.name)||file.name.includes('..'))throw Error('Invalid archive entry');
  const name=Buffer.from(file.name),head=Buffer.alloc(30),entry=Buffer.alloc(46),start=offset;
  const flags=0x0808; // UTF-8 names + trailing data descriptor.
  head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(flags,6);head.writeUInt16LE(name.length,26);
  yield head;yield name;offset+=head.length+name.length;
  let crc=-1,size=0;
  const data=typeof file.data==='function'?file.data():file.data;
  const chunks=typeof data==='string'||data instanceof Uint8Array?[data]:data;
  for await(const chunk of chunks){
   const bytes=Buffer.from(chunk);
   for(const byte of bytes)crc=CRC_TABLE[(crc^byte)&0xff]^(crc>>>8);
   size+=bytes.length;offset+=bytes.length;
   if(offset>0xffffffff)throw Error('Archive exceeds ZIP32 limit');
   yield bytes;
  }
  crc=(crc^-1)>>>0;
  const descriptor=Buffer.alloc(16);descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(crc,4);descriptor.writeUInt32LE(size,8);descriptor.writeUInt32LE(size,12);
  yield descriptor;offset+=descriptor.length;
  entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(flags,8);
  entry.writeUInt32LE(crc,16);entry.writeUInt32LE(size,20);entry.writeUInt32LE(size,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(start,42);
  central.push(entry,name);
 }
 const start=offset;
 for(const chunk of central){yield chunk;offset+=chunk.length;}
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(offset-start,12);end.writeUInt32LE(start,16);yield end;
}
export function deliveryZip(files,{onClose=()=>{}}={}) {
 const iterator=zipChunks(files);
 return new ReadableStream({
  async pull(controller){try{const next=await iterator.next();if(next.done){await onClose();controller.close();}else controller.enqueue(next.value);}catch(error){await onClose();controller.error(error);}},
  async cancel(){await onClose();await iterator.return().catch(()=>{});},
 });
}
