// ZIP stored entries, for a bounded collection of generated safe filenames.
export function deliveryZip(files) {
 const crc32=buffer=>{let crc=-1;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^-1)>>>0;};
 const local=[],central=[];let offset=0;
 for(const file of files){
  if(!/^[a-z0-9-]+\.(html|txt|json)$/.test(file.name))throw Error('Invalid archive entry');
  const name=Buffer.from(file.name),data=Buffer.from(file.data),crc=crc32(data),head=Buffer.alloc(30),entry=Buffer.alloc(46);
  head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt32LE(crc,14);head.writeUInt32LE(data.length,18);head.writeUInt32LE(data.length,22);head.writeUInt16LE(name.length,26);local.push(head,name,data);
  entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);central.push(entry,name);offset+=head.length+name.length+data.length;
 }
 const c=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(c.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,c,end]);
}
