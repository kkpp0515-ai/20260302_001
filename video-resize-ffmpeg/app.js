'use strict';
const $=id=>document.getElementById(id),M=ResizeModel,Z=ZipWriter,Store=CacheStore;
const canvas=$('preview'),ctx=canvas.getContext('2d'),source=$('sourceVideo'),endVideo=$('endVideo');
const SETTINGS_KEY='ctw.videoResize.settings.v1',LAYOUT_KEY='ctw.videoResize.layouts.v1',CACHE_LIMIT=1.5*1024**3;
const DEFAULT_LAYOUT={mode:'height',zoom:1,dx:0,dy:0};

/* ---------- 状態 ---------- */
// sources: 読み込んだ元動画 [{id,file,url,info:{w,h,duration},key,layouts:{サイズ:{mode,zoom,dx,dy}}}]
const state={catalog:null,title:null,sources:[],current:null,lang:'ja',size:'1080x1080',phase:'main',busy:false,aborted:false,playing:false,engine:null,logs:[],
 jobIndex:0,jobTotal:1,step:{duration:1,from:0,to:1},previewSerial:0,sourceSerial:0,band:null,endKey:null,results:[],controller:null,folder:{handle:null,failed:false}};
let includeEndPreference=true,sourceUid=0;
const cur=()=>state.current;
const hasEndcards=()=>state.title?.languages.every(l=>!!state.title.assets[l.id].endcard);
const images=new Map(),blobs=new Map(),endInfos=new Map(),fingerprints=new Map();
const selected=id=>[...$(id).querySelectorAll('input:checked')].map(e=>e.value);
const langs=()=>state.title?.languages||[];
const langName=id=>langs().find(l=>l.id===id)?.label||id;
const asset=lang=>{const a=state.title.assets[lang];return {...a,bands:a.bandVariants?.[$('bandVariant').value]||a.bands};};
const mediaInfo=v=>({w:v.videoWidth,h:v.videoHeight,duration:v.duration});
const bounded=(n,min,max)=>Math.min(max,Math.max(min,n));
const copy=o=>JSON.parse(JSON.stringify(o));
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}

/* ---------- この端末への保存（設定・構図） ---------- */
const readJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch(e){return fallback;}};
const writeJSON=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}};
const saved=readJSON(SETTINGS_KEY,{});
function saveSettings(){writeJSON(SETTINGS_KEY,{title:state.title?.id,languages:selected('languages'),formats:selected('formats'),includeEnd:includeEndPreference,includeBand:$('includeBand').checked,bandVariant:$('bandVariant').value,zipLayout:$('zipLayout').value,autoSave:$('autoSave').checked});}
// 構図は「タイトル・帯の種類・帯の有無」が同じ場合だけ再利用する（帯の枠が変わると位置が合わなくなるため）
const layoutContext=()=>state.title?state.title.id+'|'+($('includeBand').checked?($('bandVariant').value||'-'):'noband'):'';
const layoutSaveTimers=new Map();
function persistLayouts(src){
 if(!src)return;clearTimeout(layoutSaveTimers.get(src.key));
 layoutSaveTimers.set(src.key,setTimeout(()=>{const all=readJSON(LAYOUT_KEY,{});all[src.key]={layouts:src.layouts,context:layoutContext(),t:Date.now()};
  for(const k of Object.keys(all).sort((a,b)=>all[b].t-all[a].t).slice(60))delete all[k];writeJSON(LAYOUT_KEY,all);},250));
}
function restoreLayouts(key){const rec=readJSON(LAYOUT_KEY,{})[key];return rec&&rec.context===layoutContext()&&rec.layouts?copy(rec.layouts):{};}
function resetAllLayouts(){for(const s of state.sources){s.layouts={};persistLayouts(s);}}

/* ---------- 素材の読み込み ---------- */
function readMedia(video,url,eventName='loadeddata'){
 return new Promise((resolve,reject)=>{
  let timer;const clean=()=>{clearTimeout(timer);video.removeEventListener(eventName,done);video.removeEventListener('error',fail);};
  const done=()=>{clean();if(!Number.isFinite(video.duration)||video.duration<=0)return reject(Error('動画の再生時間を取得できません。'));if(!video.videoWidth)return reject(Error('映像が見つかりません。動画ファイルを選んでください。'));resolve(mediaInfo(video));};
  const fail=()=>{clean();reject(Error('動画を読み込めません。MP4（H.264）形式をお試しください。'));};
  video.addEventListener(eventName,done);video.addEventListener('error',fail);timer=setTimeout(()=>{clean();reject(Error('動画の読み込みがタイムアウトしました。通信状態を確認してください。'));},60000);
  video.src=url;video.load();
 });
}
async function blobAt(url,signal){
 if(!blobs.has(url)){const p=fetch(url,{signal}).then(r=>{if(!r.ok)throw Error('登録素材を取得できません（'+r.status+'）。ページを再読み込みしてください。');return r.blob();}).catch(e=>{blobs.delete(url);throw e;});blobs.set(url,p);}
 return blobs.get(url);
}
// 素材が差し替わったか判定するための指紋：ファイルサイズ＋先頭/末尾64KBの内容。取得できなければ '-'（URLだけで判定）
function hashBytes(bytes){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<bytes.length;i++){h1=Math.imul(h1^bytes[i],2654435761);h2=Math.imul(h2^bytes[i],1597334677);}
 h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (4294967296*(2097151&h2)+(h1>>>0)).toString(36);}
async function readHead(response,limit){const reader=response.body.getReader(),parts=[];let n=0;while(n<limit){const {done,value}=await reader.read();if(done)break;parts.push(value);n+=value.length;}reader.cancel().catch(()=>{});const out=new Uint8Array(Math.min(n,limit));let o=0;for(const p of parts){const take=Math.min(p.length,out.length-o);out.set(p.subarray(0,take),o);o+=take;if(o>=out.length)break;}return out;}
function fingerprint(url){
 if(!fingerprints.has(url))fingerprints.set(url,(async()=>{
  try{
   const LIMIT=65536,head=await fetch(url,{headers:{Range:'bytes=0-'+(LIMIT-1)}});if(!head.ok)return '-';
   let total=Number((head.headers.get('content-range')||'').split('/')[1])||Number(head.headers.get('content-length'))||0,tail='';
   const headHash=hashBytes(await readHead(head,LIMIT));
   if(head.status===206&&total>LIMIT){const t=await fetch(url,{headers:{Range:'bytes='+(total-LIMIT)+'-'+(total-1)}});if(t.status===206)tail=hashBytes(new Uint8Array(await t.arrayBuffer()));}
   return total+'~'+headHash+'~'+tail;
  }catch(e){return '-';}
 })());
 return fingerprints.get(url);
}
function transparentBox(image){
 const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
 const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(image,0,0);
 const {data}=cx.getImageData(0,0,c.width,c.height),heights=new Int32Array(c.width);let best=null,area=0;
 for(let y=0;y<c.height;y++){for(let x=0;x<c.width;x++)heights[x]=data[(y*c.width+x)*4+3]<128?heights[x]+1:0;const stack=[];
 for(let x=0;x<=c.width;x++){const height=x===c.width?0:heights[x];let start=x;while(stack.length&&stack[stack.length-1].height>height){const p=stack.pop(),a=(x-p.start)*p.height;if(a>area){area=a;best={x:p.start,y:y-p.height+1,w:x-p.start,h:p.height};}start=p.start;}if(height>0&&(!stack.length||stack[stack.length-1].height<height))stack.push({start,height});}}
 if(!best||area<c.width*c.height*.05)throw Error('帯画像の透過部分を取得できません。');
 return best;
}
async function bandAt(lang,size){
 const url=$('includeBand').checked?asset(lang).bands[size]:null;
 if(!url)return null;
 if(!images.has(url)){const p=(async()=>{const img=new Image();img.src=url;await img.decode();return {image:img,box:transparentBox(img),url};})().catch(e=>{images.delete(url);throw e;});images.set(url,p);}
 return images.get(url);
}
function fullBox(size){return {x:0,y:0,...M.sizes[size]};}
function mappedBox(band,size){const s=M.sizes[size];return band?{x:band.box.x*s.w/band.image.naturalWidth,y:band.box.y*s.h/band.image.naturalHeight,w:band.box.w*s.w/band.image.naturalWidth,h:band.box.h*s.h/band.image.naturalHeight}:fullBox(size);}

/* ---------- 構図・プレビュー ---------- */
function layout(size,src=cur()){return src.layouts[size]||(src.layouts[size]={...DEFAULT_LAYOUT});}
function mainPlacement(src,size,box,l=layout(size,src)){const base=M.fit(src.info,box,l.mode),scale=base.scale*l.zoom;return {scale,x:box.x+(box.w-src.info.w*scale)/2+l.dx,y:box.y+(box.h-src.info.h*scale)/2+l.dy};}
function currentMedia(){return state.phase==='end'?endVideo:source;}
function pause(){state.playing=false;source.pause();endVideo.pause();$('play').textContent='▶';$('play').setAttribute('aria-label','プレビューを再生');}
function clock(t){return Math.floor(t/60)+':'+Math.floor(t%60).toString().padStart(2,'0');}
function draw(){
 const s=M.sizes[state.size];if(canvas.width!==s.w||canvas.height!==s.h){canvas.width=s.w;canvas.height=s.h;}
 ctx.fillStyle='#0b1715';ctx.fillRect(0,0,s.w,s.h);
 const src=cur(),video=currentMedia(),box=mappedBox(state.band,state.size);
 if(video.readyState>=2&&(state.phase==='end'||src)){
  const info=state.phase==='end'?mediaInfo(video):src.info,p=state.phase==='end'?M.fit(info,box,'contain'):mainPlacement(src,state.size,box);
  ctx.drawImage(video,p.x,p.y,info.w*p.scale,info.h*p.scale);
 }
 if(state.band)ctx.drawImage(state.band.image,0,0,s.w,s.h);
 $('emptyPreview').hidden=!!src||state.phase==='end';
 const d=Number.isFinite(video.duration)?video.duration:0,t=video.currentTime||0;$('seek').max=d||1;$('seek').value=t;$('clock').textContent=clock(t)+' / '+clock(d);
 $('previewBadge').textContent=state.lang.toUpperCase()+' · '+s.ratio;
}
async function loadEndPreview(lang){
 const key=state.title.id+':'+lang;if(state.endKey===key&&endVideo.readyState>=2)return;
 const info=await readMedia(endVideo,asset(lang).endcard);state.endKey=key;
 $('endNote').textContent='各言語のフタ動画を末尾に追加（表示中：'+info.duration.toFixed(1)+'秒）';
}
async function refreshPreview(){
 const serial=++state.previewSerial;pause();state.band=null;$('assetStatus').textContent='素材を読み込み中…';draw();
 try{
  const band=await bandAt(state.lang,state.size);
  if(serial!==state.previewSerial)return;
  state.band=band;
  if(state.phase==='end')await loadEndPreview(state.lang);
  if(serial!==state.previewSerial)return;
  $('assetStatus').textContent=(band?'帯あり':'帯なし')+' / '+($('includeEnd').checked?'フタ動画あり':'フタ動画なし');syncAdjustments();draw();syncControls();
 }catch(e){if(serial===state.previewSerial){$('assetStatus').textContent='素材の読み込みに失敗';status(e.message,true);}}
}
function syncAdjustments(){const l=cur()?layout(state.size):DEFAULT_LAYOUT;$('zoom').value=l.zoom;$('zoomValue').value=Math.round(l.zoom*100)+'%';$('offsetX').value=Math.round(l.dx);$('offsetY').value=Math.round(l.dy);}
function syncControls(){
 const languages=selected('languages'),formats=selected('formats'),sources=state.sources.length,n=Math.max(1,sources)*languages.length*formats.length;
 $('jobCount').textContent=n;$('jobSummary').textContent=(sources>1?sources+'本 × ':'')+languages.length+'言語 × '+formats.length+'サイズ'+(sources?'':'（元動画1本あたり）');
 $('generate').textContent=state.busy?'生成しています…':(sources?n:0)+'本の動画を生成 ↗';
 document.querySelectorAll('#setup input,#setup select,#setup button,.preview-panel button,.preview-panel select,.preview-panel input').forEach(e=>e.disabled=state.busy);
 $('generate').disabled=state.busy||!sources||!languages.length||!formats.length||!state.title;
 $('cancel').hidden=!state.busy;$('cancel').disabled=false;
 $('play').disabled=state.busy||currentMedia().readyState<2;$('seek').disabled=$('play').disabled;
 $('includeEnd').disabled=state.busy||!hasEndcards();
 $('showEnd').disabled=state.busy||!$('includeEnd').checked;
 $('applyLayoutAll').hidden=state.sources.length<2;$('applyLayoutAll').disabled=state.busy;
 $('downloadAll').disabled=state.busy;$('downloadZip').disabled=state.busy;$('clearResults').disabled=state.busy;
 $('pickFolder').disabled=state.busy;$('autoSave').disabled=state.busy||!state.folder.handle;
}
function renderTitle(){
 const title=state.title;
 $('includeEnd').checked=hasEndcards()&&includeEndPreference;
 $('endNote').textContent=hasEndcards()?'各言語の付加動画を末尾に追加':'このタイトルには付加動画が登録されていません';
 if(!$('includeEnd').checked){state.phase='main';setPhaseButtons();}
 $('bandVariantField').hidden=!title.bandVariants?.length;$('bandVariant').replaceChildren();for(const v of title.bandVariants||[]){const o=document.createElement('option');o.value=v.id;o.textContent=v.label;$('bandVariant').append(o);}
 $('bandVariant').value=title.defaultBandVariant||'';
 if(saved.title===title.id&&saved.bandVariant&&[...$('bandVariant').options].some(o=>o.value===saved.bandVariant))$('bandVariant').value=saved.bandVariant;
 $('languages').replaceChildren();$('previewLanguage').replaceChildren();
 const restoreLangs=saved.title===title.id&&Array.isArray(saved.languages)&&title.languages.some(l=>saved.languages.includes(l.id));
 for(const lang of title.languages){
  const label=document.createElement('label');label.className='choice';const check=document.createElement('input');check.type='checkbox';check.value=lang.id;check.checked=restoreLangs?saved.languages.includes(lang.id):true;
  const text=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=lang.label;small.textContent=lang.id.toUpperCase();text.append(strong,small);label.append(check,text);$('languages').append(label);
  const opt=document.createElement('option');opt.value=lang.id;opt.textContent=lang.label;$('previewLanguage').append(opt);
 }
 state.lang=title.languages[0].id;const bandCount=title.languages.reduce((n,l)=>n+Object.keys(title.assets[l.id].bands).length,0),endCount=title.languages.filter(l=>title.assets[l.id].endcard).length;$('catalogInfo').textContent=title.languages.length+'言語 / 帯'+bandCount+'枚 / フタ動画'+endCount+'本';$('assetSummary').textContent=title.label+'：帯'+bandCount+'枚・フタ動画'+endCount+'本';$('assetLanguageCount').textContent=title.languages.length;state.endKey=null;syncControls();refreshPreview();
}
function renderFormats(){
 for(const [id,s] of Object.entries(M.sizes)){
  const label=document.createElement('label');label.className='size-choice';
  const check=document.createElement('input');check.type='checkbox';check.value=id;check.checked=Array.isArray(saved.formats)&&saved.formats.some(f=>M.sizes[f])?saved.formats.includes(id):true;
  const icon=document.createElement('span');icon.className='ratio-icon '+(s.w>s.h?'landscape':s.h>s.w?'portrait':'');
  const name=document.createElement('strong');name.textContent=s.label;const small=document.createElement('small');small.textContent=id.replace('x',' × ');
  label.append(check,icon,name,small);$('formats').append(label);
  const b=document.createElement('button');b.type='button';b.textContent=s.ratio;b.dataset.size=id;b.className=id===state.size?'active':'';b.onclick=()=>{if(state.busy)return;state.size=id;document.querySelectorAll('#previewFormats button').forEach(x=>x.classList.toggle('active',x===b));refreshPreview();};$('previewFormats').append(b);
 }
}

/* ---------- 元動画（複数） ---------- */
async function probeFile(file){
 const url=URL.createObjectURL(file),v=document.createElement('video');v.muted=true;v.preload='metadata';
 try{return {url,info:await readMedia(v,url,'loadedmetadata')};}
 catch(e){URL.revokeObjectURL(url);throw e;}
 finally{v.removeAttribute('src');v.load();}
}
function updateInfo(){
 const n=state.sources.length;
 $('videoInfo').textContent=n?n+'本の元動画 · 合計 '+state.sources.reduce((t,s)=>t+s.info.duration,0).toFixed(1)+'秒'+(n>1?'（一覧から選ぶとプレビューを切り替えられます）':''):'元動画を選択してください（複数可）。';
}
function renderSources(){
 const box=$('sourceList');box.replaceChildren();box.hidden=!state.sources.length;
 for(const src of state.sources){
  const row=document.createElement('div');row.className='source-row'+(src===state.current?' active':'');
  const pick=document.createElement('button');pick.type='button';pick.className='source-pick';
  const name=document.createElement('strong'),meta=document.createElement('small');name.textContent=src.file.name;
  meta.textContent=src.info.w+' × '+src.info.h+' · '+src.info.duration.toFixed(1)+'秒 · '+(src.file.size/1048576).toFixed(1)+' MB';
  pick.append(name,meta);pick.onclick=()=>{if(src!==state.current)selectSource(src);};
  const del=document.createElement('button');del.type='button';del.className='source-remove';del.textContent='×';del.setAttribute('aria-label',src.file.name+' を一覧から外す');del.onclick=()=>removeSource(src);
  row.append(pick,del);box.append(row);
 }
 updateInfo();
}
async function addFiles(fileList){
 if(state.busy)return;
 const files=[...fileList].filter(f=>f&&(f.type.startsWith('video/')||/\.(mp4|mov|m4v|webm)$/i.test(f.name)));
 if(!files.length)return status('動画ファイル（MP4 / MOV / WebM）を選んでください。',true);
 const errors=[];let added=0;
 for(const file of files){
  if(state.sources.some(s=>s.file.name===file.name&&s.file.size===file.size&&s.file.lastModified===file.lastModified))continue;
  status('元動画を読み込み中… '+file.name);
  try{const {url,info}=await probeFile(file);const key=file.name+'|'+file.size;state.sources.push({id:++sourceUid,file,url,info,key,layouts:restoreLayouts(key)});added++;}
  catch(e){errors.push(file.name+'：'+e.message);}
 }
 renderSources();
 if(!state.current&&state.sources.length)await selectSource(state.sources[0]);else syncControls();
 if(errors.length)status(errors.join(' / '),true);
 else if(added)status(added+'本を追加しました。構図を確認して生成してください。');
}
async function selectSource(src){
 if(state.busy||!src)return;
 const token=++state.sourceSerial;pause();state.current=src;renderSources();syncControls();
 try{
  await readMedia(source,src.url);if(token!==state.sourceSerial)return;
  state.phase='main';setPhaseButtons();syncAdjustments();syncControls();await refreshPreview();
 }catch(e){if(token===state.sourceSerial){$('videoInfo').textContent='読み込み失敗';status(src.file.name+'：'+e.message,true);}}
}
function removeSource(src){
 if(state.busy)return;
 const i=state.sources.indexOf(src);if(i<0)return;
 state.sources.splice(i,1);
 if(state.current===src){
  state.sourceSerial++;pause();state.current=null;source.removeAttribute('src');source.load();
  if(state.sources.length)selectSource(state.sources[Math.min(i,state.sources.length-1)]);else{syncAdjustments();refreshPreview();}
 }
 URL.revokeObjectURL(src.url);renderSources();syncControls();
}
function setPhaseButtons(){$('showMain').classList.toggle('active',state.phase==='main');$('showEnd').classList.toggle('active',state.phase==='end');}
async function setPhase(phase){if(state.busy)return;state.phase=phase;setPhaseButtons();await refreshPreview();}
async function seek(time){const v=currentMedia();if(v.readyState<2)return;pause();v.currentTime=bounded(time,0,Math.max(0,v.duration-.001));}
function animate(){if(state.playing){draw();requestAnimationFrame(animate);}}

/* ---------- 画面操作 ---------- */
for(const v of [source,endVideo]){v.addEventListener('seeked',draw);v.addEventListener('timeupdate',()=>{if(!state.playing)draw();});v.addEventListener('ended',()=>{pause();draw();});}
$('play').onclick=async()=>{try{if(state.playing)return pause();const v=currentMedia();if(v.currentTime>=v.duration-.02)v.currentTime=0;await v.play();state.playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','プレビューを一時停止');animate();}catch(e){status('プレビューを再生できません：'+e.message,true);}};
$('seek').oninput=e=>seek(Number(e.target.value));$('showMain').onclick=()=>setPhase('main');$('showEnd').onclick=()=>setPhase('end');
$('videoInput').onchange=e=>{addFiles(e.target.files);e.target.value='';};
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();if(!state.busy)$('dropzone').classList.add('drag-over');});
for(const event of ['dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('drag-over');if(event==='drop'&&!state.busy)addFiles(e.dataTransfer.files);});
$('previewLanguage').onchange=e=>{state.lang=e.target.value;refreshPreview();};
$('title').onchange=()=>{state.title=state.catalog.titles.find(t=>t.id===$('title').value);resetAllLayouts();renderTitle();saveSettings();};
$('languages').onchange=()=>{syncControls();saveSettings();};$('formats').onchange=()=>{syncControls();saveSettings();};
$('selectAll').onclick=()=>{document.querySelectorAll('#languages input').forEach(e=>e.checked=true);syncControls();saveSettings();};
$('bandVariant').onchange=()=>{resetAllLayouts();refreshPreview();saveSettings();};
$('includeBand').onchange=()=>{resetAllLayouts();refreshPreview();saveSettings();};
$('includeEnd').onchange=()=>{includeEndPreference=$('includeEnd').checked;if(!$('includeEnd').checked&&state.phase==='end')setPhase('main');else refreshPreview();syncControls();saveSettings();};
$('zipLayout').onchange=saveSettings;$('autoSave').onchange=saveSettings;
for(const button of document.querySelectorAll('[data-fit]'))button.onclick=()=>{if(!cur())return;cur().layouts[state.size]={...DEFAULT_LAYOUT,mode:button.dataset.fit};persistLayouts(cur());syncAdjustments();draw();};
$('zoom').oninput=e=>{if(!cur())return;layout(state.size).zoom=+e.target.value;persistLayouts(cur());syncAdjustments();draw();};
for(const [id,key] of [['offsetX','dx'],['offsetY','dy']])$(id).oninput=e=>{if(!cur())return;layout(state.size)[key]=bounded(Number(e.target.value)||0,-8000,8000);persistLayouts(cur());draw();};
$('resetLayout').onclick=()=>{if(!cur())return;delete cur().layouts[state.size];persistLayouts(cur());syncAdjustments();draw();};
$('applyLayoutAll').onclick=()=>{if(!cur())return;const l=layout(state.size);for(const s of state.sources){if(s!==cur()){s.layouts[state.size]={...l};persistLayouts(s);}}status(M.sizes[state.size].label+'の構図を、読み込み済みの全ての元動画に適用しました。');};
let drag=null;canvas.onpointerdown=e=>{if(state.busy||!cur()||state.phase!=='main')return;drag={x:e.clientX,y:e.clientY,dx:layout(state.size).dx,dy:layout(state.size).dy};canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(!drag||state.busy)return;const r=canvas.getBoundingClientRect(),l=layout(state.size);l.dx=drag.dx+(e.clientX-drag.x)*canvas.width/r.width;l.dy=drag.dy+(e.clientY-drag.y)*canvas.height/r.height;persistLayouts(cur());syncAdjustments();draw();};
canvas.onpointerup=canvas.onpointercancel=()=>drag=null;

/* ---------- フタ動画の保存データ（このPC内） ---------- */
const cacheGet=async key=>{try{const r=await Store.getSegment(key);return r&&r.blob&&r.blob.size>2000&&r.meta&&r.meta.duration>0?r:null;}catch(e){return null;}};
async function cachePut(key,blob,meta){try{await Store.putSegment(key,blob,meta);await Store.prune(CACHE_LIMIT);refreshCacheInfo();return true;}catch(e){return false;}}
const cacheDrop=async keys=>{for(const k of keys)try{await Store.deleteSegment(k);}catch(e){}refreshCacheInfo();};
async function refreshCacheInfo(){
 try{const {count,bytes}=await Store.segmentStats();$('cacheInfo').textContent=count?'フタ動画の保存データ：'+count+'件 / '+(bytes/1048576).toFixed(0)+' MB（このPC内）':'フタ動画の保存データ：なし（初回の生成時に作成されます）';$('clearCache').hidden=!count;}
 catch(e){$('cacheInfo').textContent='このブラウザでは保存データを使えないため、毎回フタ動画を合成します。';$('clearCache').hidden=true;}
}
$('clearCache').onclick=async()=>{if(state.busy)return;try{await Store.clearSegments();}catch(e){}refreshCacheInfo();status('フタ動画の保存データを削除しました。次回の生成時に作り直します。');};

/* ---------- 変換エンジン ---------- */
function checkAborted(){if(state.aborted)throw Error('生成を中止しました。');}
async function ensureEngine(){
 if(state.engine)return state.engine;if(!window.FFmpegWASM)throw Error('変換エンジンを読み込めません。ページを再読み込みしてください。');
 status('変換エンジンを準備中…（初回 約32MB）');
 const engine=new FFmpegWASM.FFmpeg();state.engine=engine;const urls=[];
 engine.on('log',({message})=>{state.logs.push(message);if(state.logs.length>100)state.logs.shift();const m=message.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);if(m&&!state.quiet){const st=state.step,f=bounded((+m[1]*3600+ +m[2]*60+ +m[3])/st.duration,0,.99);$('progress').value=(state.jobIndex+st.from+f*(st.to-st.from))/state.jobTotal;}});
 try{const get=async(name,type)=>{const r=await fetch('vendor/'+name,{signal:state.controller.signal});if(!r.ok)throw Error('変換エンジンの取得に失敗しました。');const u=URL.createObjectURL(new Blob([await r.arrayBuffer()],{type}));urls.push(u);return u;};
 const coreURL=await get('ffmpeg-core.js','text/javascript'),wasmURL=await get('ffmpeg-core.wasm','application/wasm');checkAborted();await engine.load({coreURL,wasmURL});return engine;
 }catch(e){engine.terminate();if(state.engine===engine)state.engine=null;throw e;}finally{urls.forEach(u=>URL.revokeObjectURL(u));}
}
async function audioPresent(engine,file){state.logs=[];await engine.exec(['-i',file,'-t','0','-f','null','-']);checkAborted();return state.logs.some(line=>/Audio:/.test(line));}
async function endInfo(lang,signal){
 const url=asset(lang).endcard;
 if(endInfos.has(url))return endInfos.get(url);
 const blob=await blobAt(url,signal),v=document.createElement('video'),u=URL.createObjectURL(blob);v.muted=true;v.preload='auto';
 try{const info=await readMedia(v,u);endInfos.set(url,info);return info;}finally{v.removeAttribute('src');v.load();URL.revokeObjectURL(u);}
}
// from〜to は、1本の生成の中でこの工程が占める進捗の範囲（0〜1）
async function runStep(engine,args,duration,from,to){state.step={duration:Math.max(.1,duration),from,to};state.logs=[];const ret=await engine.exec(args);checkAborted();return ret;}
// ffmpegは中間ファイルが壊れていてもエラーを返さず、映像だけが短い動画を出すことがある。出力の映像の長さを（再エンコードせず）確認する。
async function videoLength(engine,file){
 state.quiet=true;state.logs=[];
 try{await engine.exec(['-i',file,'-map','0:v:0','-c','copy','-f','null','-']);checkAborted();}finally{state.quiet=false;}
 for(let i=state.logs.length-1;i>=0;i--){const m=state.logs[i].match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);if(m)return +m[1]*3600+ +m[2]*60+ +m[3];}
 return null;
}
const ffmpegError=()=>Error('FFmpeg変換に失敗しました。素材の形式や空きメモリをご確認ください。 '+state.logs.slice(-2).join(' '));
const writeBytes=async(engine,name,blob)=>engine.writeFile(name,new Uint8Array(await blob.arrayBuffer()));

/* ---------- 保存先 ---------- */
function folderOf(result,mode,sourceDirs){
 if(mode==='lang')return result.lang;
 if(mode==='size')return result.size.replace('x','-');
 if(mode==='source')return sourceDirs.get(result.base);
 return '';
}
// 元動画ごとのフォルダ名（拡張子を除いたファイル名。同名があれば短いIDを付けて区別）
function sourceDirNames(results){
 const map=new Map(),used=new Set();
 for(const r of results){if(map.has(r.base))continue;let n=M.safeName(r.source.replace(/\.[^.]+$/,''));if(used.has(n))n+='_'+r.base.slice(0,6);used.add(n);map.set(r.base,n);}
 return map;
}
async function writeToFolder(root,result,mode,sourceDirs){
 let dir=root;const sub=folderOf(result,mode,sourceDirs);
 if(sub)for(const part of sub.split('/'))dir=await dir.getDirectoryHandle(part,{create:true});
 const file=await dir.getFileHandle(result.name,{create:true}),writer=await file.createWritable();await writer.write(result.blob);await writer.close();
}
const folderSupported=()=>typeof window.showDirectoryPicker==='function';
function renderFolder(){
 $('folderRow').hidden=!folderSupported();
 $('folderName').textContent=state.folder.handle?state.folder.handle.name:'未選択';
 $('autoSave').disabled=state.busy||!state.folder.handle;
}
async function pickFolder(){
 try{const handle=await window.showDirectoryPicker({id:'ctw-video-resize',mode:'readwrite'});state.folder.handle=handle;state.folder.failed=false;try{await Store.putHandle(handle);}catch(e){}$('autoSave').checked=true;renderFolder();saveSettings();status('保存先フォルダ「'+handle.name+'」を設定しました。生成が完了した動画から順に保存します。');}
 catch(e){if(e.name!=='AbortError')status('フォルダを選択できませんでした：'+e.message,true);}
}
async function folderAccess(request){
 const handle=state.folder.handle;if(!handle)return null;
 try{let p=await handle.queryPermission({mode:'readwrite'});if(p!=='granted'&&request)p=await handle.requestPermission({mode:'readwrite'});return p==='granted'?handle:null;}catch(e){return null;}
}
$('pickFolder').onclick=pickFolder;

/* ---------- 生成 ---------- */
function queueRow(job){
 const row=document.createElement('div');row.className='queue-row';const dot=document.createElement('span');dot.className='queue-dot';const title=document.createElement('div');title.className='queue-title';title.textContent=langName(job.lang)+' · '+M.sizes[job.size].label;const small=document.createElement('small');small.textContent=(state.sources.length>1?job.s.src.file.name+' → ':'')+job.name;title.append(small);const label=document.createElement('span');label.className='queue-state';label.textContent='待機中';row.append(dot,title,label);$('queue').append(row);return {row,label,job};
}
async function addResult(item,bytes,folder,snap){
 const job=item.job,blob=new Blob([bytes],{type:'video/mp4'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=job.name;link.textContent='MP4を保存 ↗';
 item.row.className='queue-row done';item.label.textContent='完了';item.row.append(link);
 const result={url,name:job.name,blob,lang:job.lang,size:job.size,base:job.s.baseId,source:job.s.src.file.name};
 state.results.push(result);$('completedCount').textContent=state.results.length+' 完了';$('resultActions').hidden=false;
 if(folder&&!state.folder.failed){
  try{await writeToFolder(folder,result,snap.zipLayout,snap.sourceDirs);item.label.textContent='完了・フォルダに保存済み';}
  catch(e){state.folder.failed=true;item.label.textContent='完了（フォルダ保存に失敗）';status('保存先フォルダに書き込めませんでした（'+e.message+'）。ここからは自動保存せず、ZIPまたは個別に保存してください。',true);}
 }
}
// フタ動画（映像・音声）を用意して作業領域に置く。保存済みならそれを使い、なければ合成して保存する。
async function prepareEnd(engine,job,band,box,snap,fsState){
 const sig=state.controller.signal,lang=job.lang,size=job.size,url=asset(lang).endcard;
 const [endcardFp,bandFp]=await Promise.all([fingerprint(url),band?fingerprint(band.url):null]);checkAborted();
 const base={title:snap.title,lang,endcard:url,endcardFp},vKey=M.endVideoKey({...base,size,band:band?band.url:null,bandFp}),aKey=M.endAudioKey(base);
 const [v,a]=await Promise.all([cacheGet(vKey),cacheGet(aKey)]);checkAborted();
 const keys=[vKey,aKey];let duration=v?v.meta.duration:a?a.meta.duration:0,rendered=false,span=0;
 if(!v||!a){
  const info=await endInfo(lang,sig);duration=info.duration;const blob=await blobAt(url,sig);checkAborted();
  await writeBytes(engine,'end.input',blob);checkAborted();
  if(!v){
   rendered=true;span=duration/(duration+job.s.info.duration)*.9;
   job.item.label.textContent='フタ動画を合成中（初回のみ）';status(langName(lang)+' · '+M.sizes[size].label+' のフタ動画を合成中（初回のみ。次回から再利用します）');
   const ret=await runStep(engine,M.buildVideoSegmentCommand({size,input:'end.input',media:info,placement:M.fit(info,box,'contain'),band:!!band,output:'seg_end.mp4'}),duration,0,span);
   if(ret!==0)throw ffmpegError();
   await cachePut(vKey,new Blob([await engine.readFile('seg_end.mp4')],{type:'video/mp4'}),{duration});fsState.endVideo=vKey;
  }
  if(!a){
   const hasAudio=await audioPresent(engine,'end.input');
   const ret=await runStep(engine,M.buildEndAudioCommand({input:'end.input',duration,hasAudio}),duration,0,.01);
   if(ret!==0)throw ffmpegError();
   await cachePut(aKey,new Blob([await engine.readFile('end_audio.wav')],{type:'audio/wav'}),{duration});fsState.endAudio=aKey;
  }
  await engine.deleteFile('end.input').catch(()=>{});blobs.delete(url);
 }
 if(v&&fsState.endVideo!==vKey){await writeBytes(engine,'seg_end.mp4',v.blob);fsState.endVideo=vKey;}
 if(a&&fsState.endAudio!==aKey){await writeBytes(engine,'end_audio.wav',a.blob);fsState.endAudio=aKey;}
 checkAborted();return {duration,rendered,span,keys};
}
// 通常の1回処理（本編＋フタ動画を一度に変換）。フタ動画なしの場合と、高速処理が失敗した場合に使う。
async function renderSinglePass(engine,job,snap,band,box,placement){
 const s=job.s,sig=state.controller.signal;let end=null,endAudio=false;
 if(snap.useEnd){
  end=await endInfo(job.lang,sig);const blob=await blobAt(asset(job.lang).endcard,sig);checkAborted();
  await writeBytes(engine,'end.input',blob);endAudio=await audioPresent(engine,'end.input');
 }
 job.item.label.textContent='変換中';
 const ret=await runStep(engine,M.buildCommand({size:job.size,main:s.info,placement,end,box,band:!!band,mainAudio:s.mainAudio,endAudio}),s.info.duration+(end?.duration||0),0,.99);
 if(end)await engine.deleteFile('end.input').catch(()=>{});
 if(ret!==0)throw ffmpegError();
}
async function runJob(engine,item,snap,fsState,folder){
 const job=item.job,s=job.s,size=job.size;job.item=item;
 item.row.className='queue-row running';item.label.textContent='素材を準備中';
 const where=langName(job.lang)+' · '+M.sizes[size].label+'（'+(state.jobIndex+1)+' / '+state.jobTotal+'）';status(where+' を準備中');
 const band=await bandAt(job.lang,size);checkAborted();
 if(band)await writeBytes(engine,'band.png',await blobAt(band.url,state.controller.signal));checkAborted();
 const box=mappedBox(band,size),placement=mainPlacement({info:s.info},size,box,s.layouts[size]||DEFAULT_LAYOUT);
 let done=false,keys=[];
 if(snap.useEnd){
  try{
   const end=await prepareEnd(engine,job,band,box,snap,fsState);keys=end.keys;
   item.label.textContent='変換中';status(where+' を生成中');
   const mainEnd=.95,from=end.rendered?end.span:0;
   let ret=await runStep(engine,M.buildVideoSegmentCommand({size,input:'main.input',media:s.info,placement,band:!!band,output:'seg_main.mp4'}),s.info.duration,from,mainEnd);
   if(ret!==0)throw ffmpegError();
   await engine.writeFile('list.txt',new TextEncoder().encode(M.concatList(['seg_main.mp4','seg_end.mp4'])));
   ret=await runStep(engine,M.buildFinalCommand({main:s.info,end:{duration:end.duration},mainAudio:s.mainAudio}),s.info.duration+end.duration,mainEnd,.99);
   if(ret!==0)throw ffmpegError();
   const expected=s.info.duration+end.duration,length=await videoLength(engine,'output.mp4');
   if(length!==null&&Math.abs(length-expected)>Math.max(.4,expected*.03))throw Error('出力の映像の長さが想定と異なります（'+length.toFixed(1)+'秒 / 想定 '+expected.toFixed(1)+'秒）');
   done=true;
  }catch(e){
   if(state.aborted)throw e;
   // 保存済みのフタ動画が壊れている等の場合に備え、破棄して通常処理に切り替える
   console.warn('高速処理に失敗したため通常処理に切り替えます',e);fsState.endVideo=fsState.endAudio=null;await cacheDrop(keys);
   status(where+'：通常処理に切り替えて続行します…');
  }
 }
 if(!done)await renderSinglePass(engine,job,snap,band,box,placement);
 const bytes=await engine.readFile('output.mp4');checkAborted();
 await addResult(item,bytes,folder,snap);
 for(const f of ['output.mp4','seg_main.mp4','list.txt'])await engine.deleteFile(f).catch(()=>{});
 $('progress').value=(state.jobIndex+1)/state.jobTotal;
}
async function generate(){
 if(state.busy||!state.sources.length)return;
 const languages=selected('languages'),formats=selected('formats');
 if(!languages.length||!formats.length)return status('言語とサイズを1つ以上選択してください。',true);
 state.busy=true;state.aborted=false;state.controller=new AbortController();pause();syncControls();$('progress').hidden=false;$('progress').value=0;
 const startedAt=Date.now(),fsState={endVideo:null,endAudio:null};let engine,failed=false,current=null,folder=null,items=[];
 try{
  // 保存先フォルダの権限確認は、ボタンを押した直後にしか行えないため最初に済ませる
  if($('autoSave').checked&&state.folder.handle){folder=await folderAccess(true);if(!folder)status('保存先フォルダへのアクセスが許可されなかったため、自動保存せずに続けます。',true);}
  state.folder.failed=false;
  const snap={title:state.title.id,useEnd:$('includeEnd').checked,zipLayout:$('zipLayout').value,
   sources:state.sources.map(src=>({src,info:{...src.info},layouts:copy(src.layouts),baseId:M.randomId(),mainAudio:false}))};
  snap.sourceDirs=sourceDirNames(snap.sources.map(s=>({base:s.baseId,source:s.src.file.name})));
  const jobs=snap.sources.flatMap(s=>M.jobs(languages,formats).map(j=>({...j,s,name:M.filename(snap.title,j.lang,s.baseId,j.size)})));
  items=jobs.map(queueRow);state.jobTotal=items.length;
  engine=await ensureEngine();checkAborted();
  let i=0;
  for(const s of snap.sources){
   checkAborted();status((snap.sources.length>1?s.src.file.name+'：':'')+'元動画を準備中…');
   await engine.writeFile('main.input',new Uint8Array(await s.src.file.arrayBuffer()));checkAborted();
   s.mainAudio=await audioPresent(engine,'main.input');
   for(;i<items.length&&items[i].job.s===s;i++){current=items[i];state.jobIndex=i;await runJob(engine,current,snap,fsState,folder);current=null;}
   await engine.deleteFile('main.input').catch(()=>{});
  }
  const sec=Math.round((Date.now()-startedAt)/1000);
  status(items.length+'本の生成が完了しました（所要 '+Math.floor(sec/60)+'分'+String(sec%60).padStart(2,'0')+'秒）。'+(folder&&!state.folder.failed?'保存先フォルダにも保存済みです。':'下のボタンからまとめて保存できます。'));
 }catch(e){failed=true;if(current){current.row.className='queue-row failed';current.label.textContent=state.aborted?'中止':'失敗';}status(state.aborted?'生成を中止しました。完了済みの動画は保存できます。':e.message,!state.aborted);}
 finally{
  for(const item of items)if(item.label.textContent==='待機中'){item.label.textContent=failed?'未生成':'待機中';}
  if(engine&&state.engine===engine)for(const file of ['main.input','end.input','band.png','output.mp4','seg_main.mp4','seg_end.mp4','end_audio.wav','list.txt'])await engine.deleteFile(file).catch(()=>{});
  state.busy=false;state.controller=null;syncControls();
 }
}
$('generate').onclick=generate;$('cancel').onclick=()=>{state.aborted=true;state.controller?.abort();if(state.engine){state.engine.terminate();state.engine=null;}};

/* ---------- 結果の保存 ---------- */
$('downloadAll').onclick=async()=>{for(const r of [...state.results]){const a=document.createElement('a');a.href=r.url;a.download=r.name;a.click();await new Promise(resolve=>setTimeout(resolve,400));}};
$('downloadZip').onclick=async()=>{
 if(state.busy||!state.results.length)return;
 const mode=$('zipLayout').value,dirs=sourceDirNames(state.results),stamp=new Date(),p=n=>String(n).padStart(2,'0');
 const zipName=(state.title?.id||'videos')+'_'+stamp.getFullYear()+p(stamp.getMonth()+1)+p(stamp.getDate())+'-'+p(stamp.getHours())+p(stamp.getMinutes())+'.zip';
 $('downloadZip').disabled=true;status('ZIPを作成しています…（'+state.results.length+'本）');
 try{
  const entries=state.results.map(r=>{const sub=folderOf(r,mode,dirs);return {name:(sub?sub+'/':'')+r.name,blob:r.blob};});
  const blob=await Z.create(entries,{onProgress:f=>status('ZIPを作成しています… '+Math.round(f*100)+'%')}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=zipName;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status('ZIP（'+zipName+' / '+(blob.size/1048576).toFixed(0)+' MB）を保存しました。');
 }catch(e){status('ZIPを作成できませんでした：'+e.message,true);}
 finally{$('downloadZip').disabled=state.busy;}
};
$('clearResults').onclick=()=>{if(state.busy)return;state.results.forEach(r=>URL.revokeObjectURL(r.url));state.results=[];$('queue').replaceChildren();$('completedCount').textContent='0 完了';$('resultActions').hidden=true;$('progress').hidden=true;status('生成結果をクリアしました。');};
window.addEventListener('beforeunload',e=>{if(state.busy){e.preventDefault();e.returnValue='';}});

/* ---------- 起動 ---------- */
(async()=>{
 renderFormats();
 $('includeBand').checked=saved.includeBand!==false;includeEndPreference=saved.includeEnd!==false;
 if(['flat','lang','size','source'].includes(saved.zipLayout))$('zipLayout').value=saved.zipLayout;
 $('autoSave').checked=!!saved.autoSave;
 renderFolder();refreshCacheInfo();updateInfo();
 if(folderSupported())Store.getHandle().then(h=>{if(h&&h.kind==='directory'){state.folder.handle=h;renderFolder();syncControls();}}).catch(()=>{});
 try{const response=await fetch('catalog.json?v=20261113-remove-camper');if(!response.ok)throw Error('タイトル設定を取得できません。');state.catalog=await response.json();$('title').replaceChildren();for(const t of state.catalog.titles){const o=document.createElement('option');o.value=t.id;o.textContent=t.label;$('title').append(o);}
  state.title=state.catalog.titles.find(t=>t.id===saved.title)||state.catalog.titles[0];if(!state.title)throw Error('登録タイトルがありません。');$('title').value=state.title.id;$('title').disabled=false;renderTitle();}
 catch(e){status(e.message,true);$('catalogInfo').textContent='読み込みに失敗しました。再読み込みしてください。';}
})();
