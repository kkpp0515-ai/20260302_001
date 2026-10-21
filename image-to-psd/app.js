'use strict';
const fileInput=document.getElementById('file'),drop=document.getElementById('drop');
const status=document.getElementById('status'),result=document.getElementById('result');
const preview=document.getElementById('preview'),download=document.getElementById('download');
const fileList=document.getElementById('file-list'),progress=document.getElementById('progress');
let selected=[],previewURL=null,busy=false;
const pause=()=>new Promise(resolve=>setTimeout(resolve,20));
function message(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
async function readImage(file){
  const url=URL.createObjectURL(file),img=new Image();img.src=url;
  try{await img.decode();return{img,url}}catch{URL.revokeObjectURL(url);throw new Error('画像を読み込めません。')}
}
async function load(files){
  if(busy||!files.length)return;
  busy=true;fileInput.disabled=true;selected=[];download.disabled=true;result.hidden=true;
  fileList.replaceChildren();preview.removeAttribute('src');preview.hidden=true;progress.hidden=true;
  if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null}
  try{
    if(files.length>100)throw new Error('一度に選べる画像は100枚までです。');
    let totalBytes=0,errors=0;result.hidden=false;
    for(let i=0;i<files.length;i++){
      const file=files[i],row=document.createElement('li');fileList.appendChild(row);
      message(`画像を確認しています… ${i+1} / ${files.length}`);
      let loaded;
      try{
        if(!/\.(png|jpe?g|webp)$/i.test(file.name)&&!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error('PNG・JPEG・WebPのみ対応');
        if(file.size>100*1024*1024)throw new Error('1枚100MB以内にしてください');
        loaded=await readImage(file);const w=loaded.img.naturalWidth,h=loaded.img.naturalHeight;
        if(!w||!h||w>30000||h>30000||w*h>25000000)throw new Error('各辺30,000px以内・2,500万画素以内にしてください');
        totalBytes+=w*h*8+256;selected.push({file,w,h,row});
        row.textContent=`${file.name} · ${w.toLocaleString()} × ${h.toLocaleString()} px · 準備完了`;
        if(files.length===1){previewURL=loaded.url;preview.src=loaded.url;preview.hidden=false}
      }catch(error){errors++;row.textContent=`${file.name} · 対象外：${error.message}`;row.className='error'}
      finally{if(loaded&&loaded.url!==previewURL)URL.revokeObjectURL(loaded.url)}
      await pause();
    }
    if(totalBytes>512*1024*1024){selected=[];throw new Error('出力予定が512MBを超えます。少ない枚数に分けて選び直してください。')}
    document.getElementById('filename').textContent=`${selected.length}枚の画像を選択`;
    document.getElementById('dimensions').textContent=selected.length?`出力予定：約${Math.max(.1,totalBytes/1024/1024).toFixed(1)}MB`:'';
    download.textContent=selected.length>1?`${selected.length}枚をPSDに変換してZIP保存`:'PSDをダウンロード';
    message(selected.length?`${selected.length}枚を変換できます。${errors?`対象外の${errors}枚は一覧をご確認ください。`:''}`:'変換できる画像がありません。一覧の理由をご確認ください。',!!errors||!selected.length);
  }catch(error){message(error.message,true)}finally{busy=false;fileInput.disabled=false;download.disabled=!selected.length}
}
fileInput.addEventListener('change',()=>{load(Array.from(fileInput.files));fileInput.value=''});
for(const event of ['dragenter','dragover'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('over')});
for(const event of ['dragleave','drop'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('over')});
drop.addEventListener('drop',e=>load(Array.from(e.dataTransfer.files)));
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
download.addEventListener('click',async()=>{
  if(!selected.length||busy)return;
  busy=true;download.disabled=true;fileInput.disabled=true;progress.hidden=false;progress.max=selected.length;progress.value=0;
  const canvas=document.createElement('canvas');
  try{
    const zip=selected.length>1?new PSDZip():null,used=new Set();let singleBlob,singleName;
    for(let i=0;i<selected.length;i++){
      const{file,w,h,row}=selected[i];message(`PSDを作成しています… ${i+1} / ${selected.length}：${file.name}`);await pause();
      const loaded=await readImage(file);
      try{
        canvas.width=w;canvas.height=h;const context=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});
        if(!context)throw new Error('画像処理を開始できませんでした。');
        context.drawImage(loaded.img,0,0);
        const buffer=encodePSD(w,h,context.getImageData(0,0,w,h).data),name=uniquePSDName(file.name,used);
        if(zip)zip.add(name,buffer);else{singleBlob=new Blob([buffer],{type:'image/vnd.adobe.photoshop'});singleName=name}
        row.textContent=`${file.name} → ${name} · 変換済み`;progress.value=i+1;
      }finally{URL.revokeObjectURL(loaded.url);canvas.width=canvas.height=0}
    }
    const url=URL.createObjectURL(zip?zip.finish():singleBlob),a=document.createElement('a');
    a.href=url;a.download=zip?'images-to-psd.zip':singleName;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    message(`${selected.length}枚のPSDを作成しました。${zip?'ZIPファイルを展開してご利用ください。':'ダウンロード先をご確認ください。'}`);
  }catch(error){message('変換を中止しました。ファイルは保存していません。'+error.message,true)}
  finally{canvas.width=canvas.height=0;busy=false;download.disabled=!selected.length;fileInput.disabled=false}
});
