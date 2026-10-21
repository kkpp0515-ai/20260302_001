(function(root){
  'use strict';
  const table=Uint32Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=(i>>>1)^((i&1)?0xedb88320:0);return i>>>0});
  function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0}
  class PSDZip{
    constructor(){this.parts=[];this.records=[];this.offset=0}
    add(name,buffer){
      const bytes=new Uint8Array(buffer),filename=new TextEncoder().encode(name);
      if(filename.length>65535||this.records.length>=65535||this.offset+bytes.length>0xffffffff)throw new Error('ZIPの上限です。画像を分けて変換してください。');
      const crc=crc32(bytes),local=new Uint8Array(30+filename.length),v=new DataView(local.buffer);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);
      v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,filename.length,true);local.set(filename,30);
      const central=new Uint8Array(46+filename.length),c=new DataView(central.buffer);
      c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);
      c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,filename.length,true);c.setUint32(42,this.offset,true);central.set(filename,46);
      this.parts.push(local,new Blob([buffer]));this.records.push(central);this.offset+=local.length+bytes.length;
    }
    finish(){
      if(!this.records.length)throw new Error('保存できるPSDがありません。');
      const end=new Uint8Array(22),v=new DataView(end.buffer);
      v.setUint32(0,0x06054b50,true);v.setUint16(8,this.records.length,true);v.setUint16(10,this.records.length,true);
      v.setUint32(12,this.records.reduce((n,r)=>n+r.length,0),true);v.setUint32(16,this.offset,true);
      return new Blob([...this.parts,...this.records,end],{type:'application/zip'});
    }
  }
  function uniquePSDName(filename,used){
    let base=filename.replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,150)||'image';
    if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base))base='_'+base;
    let name=base+'.psd',n=2;while(used.has(name.toLowerCase()))name=base+' ('+n+++').psd';
    used.add(name.toLowerCase());return name;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={PSDZip,uniquePSDName};else{root.PSDZip=PSDZip;root.uniquePSDName=uniquePSDName}
})(globalThis);
