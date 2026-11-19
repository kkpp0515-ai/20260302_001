// 外部ライブラリなしのZIP書き出し（無圧縮=STORE）。MP4はすでに圧縮済みのため、圧縮しても容量はほぼ変わらない。
// 使い方: const blob = await ZipWriter.create([{name:'ja/a.mp4', blob:Blob}, ...]);
(function(root){
'use strict';
const LIMIT=0xFFFFFFFF;
const table=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(bytes,crc=0){let c=~crc>>>0;for(let i=0;i<bytes.length;i++)c=table[(c^bytes[i])&0xFF]^(c>>>8);return ~c>>>0;}
// Blob を一定サイズずつ読んでCRC32を計算する（巨大ファイルでもメモリを使いすぎない）
async function blobCrc(blob,chunk=8*1024*1024){let crc=0;for(let o=0;o<blob.size;o+=chunk)crc=crc32(new Uint8Array(await blob.slice(o,o+chunk).arrayBuffer()),crc);return crc;}
function dosDateTime(d){
 const y=Math.max(1980,d.getFullYear());
 return {time:(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),date:((y-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()};
}
function cleanName(name){return String(name).replace(/\\/g,'/').replace(/^\/+/,'').replace(/[\x00-\x1f]/g,'_');}
async function create(entries,{now=new Date(),onProgress}={}){
 if(entries.length>0xFFFF)throw Error('ZIPに入れられるファイル数の上限（65535）を超えています。');
 const enc=new TextEncoder(),parts=[],central=[],{time,date}=dosDateTime(now),seen=new Set();
 let offset=0;
 for(let i=0;i<entries.length;i++){
  const e=entries[i],name=cleanName(e.name);
  if(!name)throw Error('ファイル名が空です。');
  if(seen.has(name))throw Error('ZIP内でファイル名が重複しています：'+name);
  seen.add(name);
  const nameBytes=enc.encode(name),size=e.blob.size;
  if(size>LIMIT||offset+size>LIMIT)throw Error('ZIPの容量が4GBを超えるため作成できません。個別保存または保存先フォルダをご利用ください。');
  const crc=await blobCrc(e.blob);
  const local=new DataView(new ArrayBuffer(30));
  local.setUint32(0,0x04034b50,true);local.setUint16(4,20,true);local.setUint16(6,0x0800,true);local.setUint16(8,0,true);
  local.setUint16(10,time,true);local.setUint16(12,date,true);local.setUint32(14,crc,true);local.setUint32(18,size,true);local.setUint32(22,size,true);
  local.setUint16(26,nameBytes.length,true);local.setUint16(28,0,true);
  parts.push(local.buffer,nameBytes,e.blob);
  const c=new DataView(new ArrayBuffer(46));
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);
  c.setUint16(12,time,true);c.setUint16(14,date,true);c.setUint32(16,crc,true);c.setUint32(20,size,true);c.setUint32(24,size,true);
  c.setUint16(28,nameBytes.length,true);c.setUint16(30,0,true);c.setUint16(32,0,true);c.setUint16(34,0,true);c.setUint16(36,0,true);c.setUint32(38,0,true);c.setUint32(42,offset,true);
  central.push(c.buffer,nameBytes);
  offset+=30+nameBytes.length+size;
  if(onProgress)onProgress((i+1)/entries.length);
 }
 const centralSize=central.reduce((n,b)=>n+(b.byteLength??b.length),0);
 if(offset+centralSize>LIMIT)throw Error('ZIPの容量が4GBを超えるため作成できません。個別保存または保存先フォルダをご利用ください。');
 const end=new DataView(new ArrayBuffer(22));
 end.setUint32(0,0x06054b50,true);end.setUint16(4,0,true);end.setUint16(6,0,true);end.setUint16(8,entries.length,true);end.setUint16(10,entries.length,true);
 end.setUint32(12,centralSize,true);end.setUint32(16,offset,true);end.setUint16(20,0,true);
 return new Blob([...parts,...central,end.buffer],{type:'application/zip'});
}
const api={create,crc32,cleanName};
if(typeof module==='object'&&module.exports)module.exports=api;else root.ZipWriter=api;
})(globalThis);
