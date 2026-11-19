// このPCのブラウザ内(IndexedDB)に保存するもの：
//  - segments: 合成済みフタ動画の映像・音声（2回目以降の生成で再利用する）
//  - meta    : 保存先フォルダのハンドル
// どれも「あれば速くなる」だけの補助機能。使えない環境（プライベートモード等）では呼び出し側が無視して通常処理に進む。
(function(root){
'use strict';
const DB_NAME='ctw-video-resize',DB_VERSION=1,SEG='segments',META='meta';
let dbPromise=null;
function open(){
 if(!root.indexedDB)return Promise.reject(Error('IndexedDB unavailable'));
 if(!dbPromise){
  dbPromise=new Promise((resolve,reject)=>{
   const r=root.indexedDB.open(DB_NAME,DB_VERSION);
   r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(SEG))db.createObjectStore(SEG);if(!db.objectStoreNames.contains(META))db.createObjectStore(META);};
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('IndexedDB blocked'));
  });
  dbPromise.catch(()=>{dbPromise=null;});
 }
 return dbPromise;
}
// 1つのトランザクションで操作を実行し、完了後に結果を返す
async function run(store,mode,fn){
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,mode);let req;
  try{req=fn(tx.objectStore(store));}catch(e){reject(e);return;}
  tx.oncomplete=()=>resolve(req&&'result' in req?req.result:undefined);
  tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('IndexedDB aborted'));
 });
}
const getSegment=async key=>(await run(SEG,'readonly',s=>s.get(key)))||null;
const putSegment=(key,blob,meta={})=>run(SEG,'readwrite',s=>s.put({blob,size:blob.size,savedAt:Date.now(),meta},key));
const deleteSegment=key=>run(SEG,'readwrite',s=>s.delete(key));
const clearSegments=()=>run(SEG,'readwrite',s=>s.clear());
async function listSegments(){
 const db=await open();
 return new Promise((resolve,reject)=>{
  const out=[],tx=db.transaction(SEG,'readonly'),req=tx.objectStore(SEG).openCursor();
  req.onsuccess=()=>{const c=req.result;if(c){out.push({key:c.key,size:c.value.size||0,savedAt:c.value.savedAt||0});c.continue();}};
  tx.oncomplete=()=>resolve(out);tx.onerror=()=>reject(tx.error);
 });
}
async function segmentStats(){const list=await listSegments();return {count:list.length,bytes:list.reduce((n,x)=>n+x.size,0)};}
// 容量が上限を超えたら、古いものから削除する
async function prune(maxBytes){
 const list=(await listSegments()).sort((a,b)=>a.savedAt-b.savedAt);let total=list.reduce((n,x)=>n+x.size,0),removed=0;
 for(const item of list){if(total<=maxBytes)break;await deleteSegment(item.key);total-=item.size;removed++;}
 return removed;
}
const getHandle=async()=>(await run(META,'readonly',s=>s.get('outputDir')))||null;
const putHandle=handle=>run(META,'readwrite',s=>s.put(handle,'outputDir'));
const clearHandle=()=>run(META,'readwrite',s=>s.delete('outputDir'));
const api={getSegment,putSegment,deleteSegment,clearSegments,segmentStats,prune,getHandle,putHandle,clearHandle};
if(typeof module==='object'&&module.exports)module.exports=api;else root.CacheStore=api;
})(globalThis);
