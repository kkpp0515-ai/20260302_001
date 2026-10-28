'use strict';
const $=id=>document.getElementById(id),M=ResizeModel,canvas=$('preview'),ctx=canvas.getContext('2d'),source=$('sourceVideo'),endVideo=$('endVideo');
const state={catalog:null,title:null,file:null,main:null,sourceURL:null,lang:'ja',size:'1080x1080',phase:'main',layouts:{},busy:false,aborted:false,playing:false,engine:null,logs:[],jobIndex:0,jobTotal:1,jobDuration:1,previewSerial:0,sourceSerial:0,band:null,endKey:null,results:[],controller:null};
const images=new Map(),blobs=new Map(),endInfos=new Map();
const selected=id=>[...$(id).querySelectorAll('input:checked')].map(e=>e.value);
const langs=()=>state.title?.languages||[];
const langName=id=>langs().find(l=>l.id===id)?.label||id;
const asset=lang=>state.title.assets[lang];
const mediaInfo=v=>({w:v.videoWidth,h:v.videoHeight,duration:v.duration});
const bounded=(n,min,max)=>Math.min(max,Math.max(min,n));
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function readMedia(video,url){
 return new Promise((resolve,reject)=>{
  let timer;const clean=()=>{clearTimeout(timer);video.removeEventListener('loadeddata',done);video.removeEventListener('error',fail);};
  const done=()=>{clean();if(!Number.isFinite(video.duration)||video.duration<=0)return reject(Error('動画の再生時間を取得できません。'));resolve(mediaInfo(video));};
  const fail=()=>{clean();reject(Error('動画を読み込めません。MP4（H.264）形式をお試しください。'));};
  video.addEventListener('loadeddata',done);video.addEventListener('error',fail);timer=setTimeout(()=>{clean();reject(Error('動画の読み込みがタイムアウトしました。通信状態を確認してください。'));},60000);
  video.src=url;video.load();
 });
}
async function blobAt(url,signal){
 if(!blobs.has(url)){const p=fetch(url,{signal}).then(r=>{if(!r.ok)throw Error('登録素材を取得できません（'+r.status+'）。ページを再読み込みしてください。');return r.blob();}).catch(e=>{blobs.delete(url);throw e;});blobs.set(url,p);}
 return blobs.get(url);
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
function layout(size){return state.layouts[size]||(state.layouts[size]={mode:'height',zoom:1,dx:0,dy:0});}
function mainPlacement(size,box){const l=layout(size),base=M.fit(state.main,box,l.mode),scale=base.scale*l.zoom;return {scale,x:box.x+(box.w-state.main.w*scale)/2+l.dx,y:box.y+(box.h-state.main.h*scale)/2+l.dy};}
function currentMedia(){return state.phase==='end'?endVideo:source;}
function pause(){state.playing=false;source.pause();endVideo.pause();$('play').textContent='▶';$('play').setAttribute('aria-label','プレビューを再生');}
function clock(t){return Math.floor(t/60)+':'+Math.floor(t%60).toString().padStart(2,'0');}
function draw(){
 const s=M.sizes[state.size];if(canvas.width!==s.w||canvas.height!==s.h){canvas.width=s.w;canvas.height=s.h;}
 ctx.fillStyle='#0b1715';ctx.fillRect(0,0,s.w,s.h);
 const video=currentMedia(),box=mappedBox(state.band,state.size);
 if(video.readyState>=2&&(state.phase==='end'||state.main)){
  const info=state.phase==='end'?mediaInfo(video):state.main,p=state.phase==='end'?M.fit(info,box,'contain'):mainPlacement(state.size,box);
  ctx.drawImage(video,p.x,p.y,info.w*p.scale,info.h*p.scale);
 }
 if(state.band)ctx.drawImage(state.band.image,0,0,s.w,s.h);
 $('emptyPreview').hidden=!!state.main||state.phase==='end';
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
function syncAdjustments(){const l=layout(state.size);$('zoom').value=l.zoom;$('zoomValue').value=Math.round(l.zoom*100)+'%';$('offsetX').value=Math.round(l.dx);$('offsetY').value=Math.round(l.dy);}
function syncControls(){
 const languages=selected('languages'),formats=selected('formats'),n=languages.length*formats.length;
 $('jobCount').textContent=n;$('jobSummary').textContent=languages.length+'言語 × '+formats.length+'サイズ';
 $('generate').textContent=state.busy?'生成しています…':n+'本の動画を生成 ↗';
 document.querySelectorAll('#setup input,#setup select,#setup button,.preview-panel button,.preview-panel select,.preview-panel input').forEach(e=>e.disabled=state.busy);
 $('generate').disabled=state.busy||!state.main||!n||!state.title;
 $('cancel').hidden=!state.busy;$('cancel').disabled=false;
 $('play').disabled=state.busy||currentMedia().readyState<2;$('seek').disabled=$('play').disabled;
 $('showEnd').disabled=state.busy||!$('includeEnd').checked;
 $('downloadAll').disabled=state.busy;$('clearResults').disabled=state.busy;
}
function renderTitle(){
 const title=state.title;
 $('languages').replaceChildren();$('previewLanguage').replaceChildren();
 for(const lang of title.languages){
  const label=document.createElement('label');label.className='choice';const check=document.createElement('input');check.type='checkbox';check.value=lang.id;check.checked=true;
  const text=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=lang.label;small.textContent=lang.id.toUpperCase();text.append(strong,small);label.append(check,text);$('languages').append(label);
  const opt=document.createElement('option');opt.value=lang.id;opt.textContent=lang.label;$('previewLanguage').append(opt);
 }
 state.lang=title.languages[0].id;const bandCount=title.languages.reduce((n,l)=>n+Object.keys(title.assets[l.id].bands).length,0),endCount=title.languages.filter(l=>title.assets[l.id].endcard).length;$('catalogInfo').textContent=title.languages.length+'言語 / 帯'+bandCount+'枚 / フタ動画'+endCount+'本';$('assetSummary').textContent=title.label+'：帯'+bandCount+'枚・フタ動画'+endCount+'本';$('assetLanguageCount').textContent=title.languages.length;state.endKey=null;state.layouts={};syncControls();refreshPreview();
}
function renderFormats(){
 for(const [id,s] of Object.entries(M.sizes)){
  const label=document.createElement('label');label.className='size-choice';
  const check=document.createElement('input');check.type='checkbox';check.value=id;check.checked=true;
  const icon=document.createElement('span');icon.className='ratio-icon '+(s.w>s.h?'landscape':s.h>s.w?'portrait':'');
  const name=document.createElement('strong');name.textContent=s.label;const small=document.createElement('small');small.textContent=id.replace('x',' × ');
  label.append(check,icon,name,small);$('formats').append(label);
  const b=document.createElement('button');b.type='button';b.textContent=s.ratio;b.dataset.size=id;b.className=id===state.size?'active':'';b.onclick=()=>{if(state.busy)return;state.size=id;document.querySelectorAll('#previewFormats button').forEach(x=>x.classList.toggle('active',x===b));refreshPreview();};$('previewFormats').append(b);
 }
}
async function loadSource(file){
 if(!file||state.busy)return;const token=++state.sourceSerial;pause();state.main=null;state.file=null;syncControls();
 if(state.sourceURL)URL.revokeObjectURL(state.sourceURL);state.sourceURL=URL.createObjectURL(file);
 $('videoInfo').textContent='動画を読み込み中…';
 try{const info=await readMedia(source,state.sourceURL);if(token!==state.sourceSerial)return;state.main=info;state.file=file;state.layouts={};state.phase='main';setPhaseButtons();
 $('uploadLabel').textContent=file.name;$('videoInfo').textContent=info.w+' × '+info.h+' · '+info.duration.toFixed(2)+'秒 · '+(file.size/1024/1024).toFixed(1)+' MB';
 $('baseName').value='';
 status('準備完了。構図を確認して生成してください。');syncAdjustments();syncControls();await refreshPreview();
 }catch(e){if(token===state.sourceSerial){$('videoInfo').textContent='読み込み失敗';status(e.message,true);syncControls();}}
}
function setPhaseButtons(){$('showMain').classList.toggle('active',state.phase==='main');$('showEnd').classList.toggle('active',state.phase==='end');}
async function setPhase(phase){if(state.busy)return;state.phase=phase;setPhaseButtons();await refreshPreview();}
async function seek(time){const v=currentMedia();if(v.readyState<2)return;pause();v.currentTime=bounded(time,0,Math.max(0,v.duration-.001));}
function animate(){if(state.playing){draw();requestAnimationFrame(animate);}}
for(const v of [source,endVideo]){v.addEventListener('seeked',draw);v.addEventListener('timeupdate',()=>{if(!state.playing)draw();});v.addEventListener('ended',()=>{pause();draw();});}
$('play').onclick=async()=>{try{if(state.playing)return pause();const v=currentMedia();if(v.currentTime>=v.duration-.02)v.currentTime=0;await v.play();state.playing=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','プレビューを一時停止');animate();}catch(e){status('プレビューを再生できません：'+e.message,true);}};
$('seek').oninput=e=>seek(Number(e.target.value));$('showMain').onclick=()=>setPhase('main');$('showEnd').onclick=()=>setPhase('end');
$('videoInput').onchange=e=>loadSource(e.target.files[0]);
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();if(!state.busy)$('dropzone').classList.add('drag-over');});
for(const event of ['dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('drag-over');if(event==='drop'&&!state.busy)loadSource(e.dataTransfer.files[0]);});
$('previewLanguage').onchange=e=>{state.lang=e.target.value;refreshPreview();};
$('title').onchange=()=>{state.title=state.catalog.titles.find(t=>t.id===$('title').value);renderTitle();};
$('languages').onchange=syncControls;$('formats').onchange=syncControls;
$('selectAll').onclick=()=>{document.querySelectorAll('#languages input').forEach(e=>e.checked=true);syncControls();};
$('includeBand').onchange=()=>{state.layouts={};refreshPreview();};
$('includeEnd').onchange=()=>{if(!$('includeEnd').checked&&state.phase==='end')setPhase('main');else refreshPreview();syncControls();};
for(const button of document.querySelectorAll('[data-fit]'))button.onclick=()=>{state.layouts[state.size]={mode:button.dataset.fit,zoom:1,dx:0,dy:0};syncAdjustments();draw();};
$('zoom').oninput=e=>{layout(state.size).zoom=+e.target.value;syncAdjustments();draw();};
for(const [id,key] of [['offsetX','dx'],['offsetY','dy']])$(id).oninput=e=>{layout(state.size)[key]=bounded(Number(e.target.value)||0,-8000,8000);draw();};
$('resetLayout').onclick=()=>{delete state.layouts[state.size];syncAdjustments();draw();};
let drag=null;canvas.onpointerdown=e=>{if(state.busy||!state.main||state.phase!=='main')return;drag={x:e.clientX,y:e.clientY,dx:layout(state.size).dx,dy:layout(state.size).dy};canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(!drag||state.busy)return;const r=canvas.getBoundingClientRect(),l=layout(state.size);l.dx=drag.dx+(e.clientX-drag.x)*canvas.width/r.width;l.dy=drag.dy+(e.clientY-drag.y)*canvas.height/r.height;syncAdjustments();draw();};
canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
async function ensureEngine(){
 if(state.engine)return state.engine;if(!window.FFmpegWASM)throw Error('変換エンジンを読み込めません。ページを再読み込みしてください。');
 status('変換エンジンを準備中…（初回 約32MB）');
 const engine=new FFmpegWASM.FFmpeg();state.engine=engine;const urls=[];
 engine.on('log',({message})=>{state.logs.push(message);if(state.logs.length>100)state.logs.shift();const m=message.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);if(m){const f=bounded((+m[1]*3600+ +m[2]*60+ +m[3])/state.jobDuration,0,.99);$('progress').value=(state.jobIndex+f)/state.jobTotal;}});
 try{const get=async(name,type)=>{const r=await fetch('vendor/'+name,{signal:state.controller.signal});if(!r.ok)throw Error('変換エンジンの取得に失敗しました。');const u=URL.createObjectURL(new Blob([await r.arrayBuffer()],{type}));urls.push(u);return u;};
 const coreURL=await get('ffmpeg-core.js','text/javascript'),wasmURL=await get('ffmpeg-core.wasm','application/wasm');checkAborted();await engine.load({coreURL,wasmURL});return engine;
 }catch(e){engine.terminate();if(state.engine===engine)state.engine=null;throw e;}finally{urls.forEach(u=>URL.revokeObjectURL(u));}
}
function checkAborted(){if(state.aborted)throw Error('生成を中止しました。');}
async function audioPresent(engine,file){state.logs=[];await engine.exec(['-i',file,'-t','0','-f','null','-']);checkAborted();return state.logs.some(line=>/Audio:/.test(line));}
async function endInfo(lang,signal){
 const url=asset(lang).endcard;
 if(endInfos.has(url))return endInfos.get(url);
 const blob=await blobAt(url,signal),v=document.createElement('video'),u=URL.createObjectURL(blob);v.muted=true;v.preload='auto';
 try{const info=await readMedia(v,u);endInfos.set(url,info);return info;}finally{v.removeAttribute('src');v.load();URL.revokeObjectURL(u);}
}
function queueRow(job){
 const row=document.createElement('div');row.className='queue-row';const dot=document.createElement('span');dot.className='queue-dot';const title=document.createElement('div');title.className='queue-title';title.textContent=langName(job.lang)+' · '+M.sizes[job.size].label;const small=document.createElement('small');small.textContent=job.name;title.append(small);const label=document.createElement('span');label.className='queue-state';label.textContent='待機中';row.append(dot,title,label);$('queue').append(row);return {row,label,job};
}
function addResult(item,bytes){
 const url=URL.createObjectURL(new Blob([bytes],{type:'video/mp4'})),link=document.createElement('a');link.href=url;link.download=item.job.name;link.textContent='MP4を保存 ↗';
 item.row.className='queue-row done';item.label.textContent='完了';item.row.append(link);
 state.results.push({url,name:item.job.name});$('completedCount').textContent=state.results.length+' 完了';$('resultActions').hidden=false;
}
async function generate(){
 if(state.busy||!state.main)return;
 const jobs=M.jobs(selected('languages'),selected('formats'));if(!jobs.length)return status('言語とサイズを1つ以上選択してください。',true);
 $('baseName').value=M.randomId();
 const snapshot={title:state.title.id,base:$('baseName').value,includeEnd:$('includeEnd').checked,main:{...state.main},layouts:JSON.parse(JSON.stringify(state.layouts))};
 jobs.forEach(job=>job.name=M.filename(snapshot.title,job.lang,snapshot.base,job.size));
 state.busy=true;state.aborted=false;state.controller=new AbortController();pause();syncControls();$('progress').hidden=false;$('progress').value=0;
 const items=jobs.map(queueRow);state.jobTotal=items.length;let engine,current=null,failed=false;
 try{
  engine=await ensureEngine();checkAborted();status('元動画を準備中…');await engine.writeFile('main.input',new Uint8Array(await state.file.arrayBuffer()));checkAborted();
  const mainAudio=await audioPresent(engine,'main.input');let currentLang=null,end=null,endAudio=false;
  for(let i=0;i<items.length;i++){
   checkAborted();current=items[i];state.jobIndex=i;const job=current.job;current.row.className='queue-row running';current.label.textContent='素材を準備中';
   status(langName(job.lang)+' · '+M.sizes[job.size].label+' を準備中（'+(i+1)+' / '+items.length+'）');
   const band=await bandAt(job.lang,job.size);checkAborted();
   if(band){const blob=await blobAt(band.url,state.controller.signal);await engine.writeFile('band.png',new Uint8Array(await blob.arrayBuffer()));}
   if(snapshot.includeEnd&&currentLang!==job.lang){
    end=await endInfo(job.lang,state.controller.signal);const blob=await blobAt(asset(job.lang).endcard,state.controller.signal);checkAborted();await engine.writeFile('end.input',new Uint8Array(await blob.arrayBuffer()));endAudio=await audioPresent(engine,'end.input');currentLang=job.lang;
   }
   checkAborted();const box=mappedBox(band,job.size),placement=mainPlacement(job.size,box);state.jobDuration=snapshot.main.duration+(end?.duration||0);
   current.label.textContent='変換中';status(langName(job.lang)+' · '+M.sizes[job.size].label+' を生成中（'+(i+1)+' / '+items.length+'）');state.logs=[];
   const result=await engine.exec(M.buildCommand({size:job.size,main:snapshot.main,placement,end,box,band:!!band,mainAudio,endAudio}));
   checkAborted();if(result!==0)throw Error('FFmpeg変換に失敗しました。素材の形式や空きメモリをご確認ください。 '+state.logs.slice(-2).join(' '));
   const bytes=await engine.readFile('output.mp4');checkAborted();addResult(current,bytes);await engine.deleteFile('output.mp4');$('progress').value=(i+1)/items.length;current=null;
  }
  status(items.length+'本の生成が完了しました。下のリンクから保存できます。');
 }catch(e){failed=true;if(current){current.row.className='queue-row failed';current.label.textContent=state.aborted?'中止':'失敗';}status(state.aborted?'生成を中止しました。完了済みの動画は保存できます。':e.message,!state.aborted);}
 finally{
  for(const item of items)if(item.label.textContent==='待機中'){item.label.textContent=failed?'未生成':'待機中';}
  if(engine&&state.engine===engine)for(const file of ['main.input','end.input','band.png','output.mp4'])await engine.deleteFile(file).catch(()=>{});
  state.busy=false;state.controller=null;syncControls();
 }
}
$('generate').onclick=generate;$('cancel').onclick=()=>{state.aborted=true;state.controller?.abort();if(state.engine){state.engine.terminate();state.engine=null;}};
$('downloadAll').onclick=async()=>{for(const r of [...state.results]){const a=document.createElement('a');a.href=r.url;a.download=r.name;a.click();await new Promise(resolve=>setTimeout(resolve,400));}};
$('clearResults').onclick=()=>{if(state.busy)return;state.results.forEach(r=>URL.revokeObjectURL(r.url));state.results=[];$('queue').replaceChildren();$('completedCount').textContent='0 完了';$('resultActions').hidden=true;$('progress').hidden=true;status('生成結果をクリアしました。');};
window.addEventListener('beforeunload',e=>{if(state.busy){e.preventDefault();e.returnValue='';}});
(async()=>{
 renderFormats();
 try{const response=await fetch('catalog.json?v=20261028-shiguang');if(!response.ok)throw Error('タイトル設定を取得できません。');state.catalog=await response.json();$('title').replaceChildren();for(const t of state.catalog.titles){const o=document.createElement('option');o.value=t.id;o.textContent=t.label;$('title').append(o);}state.title=state.catalog.titles[0];if(!state.title)throw Error('登録タイトルがありません。');renderTitle();}
 catch(e){status(e.message,true);$('catalogInfo').textContent='読み込みに失敗しました。再読み込みしてください。';}
})();
