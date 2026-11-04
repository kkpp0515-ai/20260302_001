'use strict';
const $=id=>document.getElementById(id),form=$('record-form');
let current=null,models={};
function message(text){$('message').textContent=text;}
function hideResult(){current=null;models={};$('links').hidden=true;$('preview-note').hidden=false;$('banner-section').hidden=true;$('banner-download').disabled=true;}
function getRecord(){return Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,v.trim()]));}
function matrix(text){
  if(typeof QRCode==='undefined')throw Error('QR作成機能を読み込めませんでした。ページを再読み込みしてください。');
  const node=document.createElement('div');
  const qr=new QRCode(node,{text,width:256,height:256,correctLevel:QRCode.CorrectLevel.M});
  return qr._oQRCode;
}
function paint(model,size){
  const count=model.getModuleCount(),quiet=4,cell=Math.max(1,Math.floor(size/(count+quiet*2))),actual=(count+quiet*2)*cell;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.fillStyle='#000';const offset=Math.floor((size-actual)/2)+quiet*cell;
  for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(model.isDark(y,x))ctx.fillRect(offset+x*cell,offset+y*cell,cell,cell);
  return canvas;
}
function showQR(){for(const kind of ['normal','deep']){const canvas=paint(models[kind],Number($('qr-size').value));canvas.setAttribute('role','img');canvas.setAttribute('aria-label',kind==='normal'?'通常URLのQRコード':'ディープリンクのQRコード');$(kind+'-qr').replaceChildren(canvas);}renderBanner();}
function generate(){
  hideResult();const record=getRecord(),result=CreatorLinks.links(record);
  showResult(record,result);
}
function showResult(record,result){
  hideResult();
  const nextModels={normal:matrix(result.normal),deep:matrix(result.deep)};
  current={record,...result};models=nextModels;
  $('campaign').value=result.campaign;$('adgroup').value=result.adgroup;$('normal-url').value=result.normal;$('deep-url').value=result.deep;
  showQR();$('links').hidden=false;$('preview-note').hidden=true;message('URLとQRコードを作成しました。');
}
form.addEventListener('submit',e=>{e.preventDefault();try{generate();}catch(e){hideResult();message(e.message);}});
form.addEventListener('input',()=>{if(current){hideResult();message('入力が変わりました。「URL・QRを作成」で更新してください。');}});
$('clear').onclick=()=>{form.reset();$('import-url').value='';hideResult();message('入力をクリアしました。');};
$('import').onclick=()=>{try{const record=CreatorLinks.parse($('import-url').value);hideResult();for(const [k,v] of Object.entries(record))form.elements.namedItem(k).value=v;generate();}catch(e){message(e.message);}};
$('qr-size').onchange=()=>{if(current)try{showQR();}catch(e){message(e.message);}};
document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{if(!current)return;const field=$(b.dataset.copy);try{await navigator.clipboard.writeText(field.value);message('URLをコピーしました。');}catch{field.focus();field.select();message('自動コピーが使えません。選択されたURLをコピーしてください。');}});
for(const kind of ['normal','deep'])$(kind+'-download').onclick=()=>{if(!current)return;try{const canvas=paint(models[kind],Number($('qr-size').value));canvas.toBlob(blob=>{if(!blob){message('PNGを作成できませんでした。');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${current.adgroup}_${kind}_qr_${canvas.width}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}catch(e){message(e.message);}};
let sheetRecords=[],loadSerial=0;
function renderPeople(){
  const query=$('creator-search').value.trim().toLowerCase(),select=$('creator-select');select.replaceChildren();
  for(let i=0;i<sheetRecords.length;i++){
    const r=sheetRecords[i];if(![r.creator,r.agency,r.title,r.language,r.id].join(' ').toLowerCase().includes(query))continue;
    const option=document.createElement('option');option.value=String(i);option.textContent=`${r.creator} ｜ ${r.agency} ｜ ${r.title} / ${r.language} ｜ ID ${r.id}`;select.append(option);
  }
  select.selectedIndex=-1;$('selected-person').textContent=select.options.length+'件から選択してください。';hideResult();
}
async function refreshSheet(){
  const serial=++loadSerial;sheetRecords=[];$('sheet-picker').hidden=true;hideResult();message('');$('sheet-refresh').disabled=true;
  $('sheet-status').textContent='スプレッドシートを読み込み中…';
  try{const data=await CreatorLiveSheet.read();if(serial!==loadSerial)return;sheetRecords=data.records;$('creator-search').value='';renderPeople();$('sheet-picker').hidden=false;$('sheet-status').textContent=`${sheetRecords.length}件を取得しました（取得時刻：${new Date().toLocaleString('ja-JP')}）。`+(data.skipped?` URL未設定・無効の${data.skipped}行は除外しました。`:'');}
  catch(e){if(serial===loadSerial)$('sheet-status').textContent=e.message;}
  finally{if(serial===loadSerial)$('sheet-refresh').disabled=false;}
}
$('sheet-refresh').onclick=refreshSheet;
$('creator-search').oninput=renderPeople;
$('creator-select').onchange=()=>{
  const value=$('creator-select').value;if(value==='')return;const record=sheetRecords[Number(value)];if(!record)return;
  try{showResult(record,record);$('selected-person').textContent=`選択中：${record.creator} / ${record.agency} / ${record.language} / ID ${record.id}`;message(record.creator+' のURL・QRを作成しました。');}catch(e){hideResult();message(e.message);}
};
let bannerImagePromise=null;
function loadBanner(){if(!bannerImagePromise)bannerImagePromise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('帯テンプレートを読み込めませんでした。再読み込みしてください。'));img.src='scimagic-frame.png';});return bannerImagePromise;}
async function renderBanner(){
  if(!current||current.record.title!=='scimagic')return;
  const selected=current,kind=$('banner-kind').value,model=models[kind];$('banner-section').hidden=false;$('banner-download').disabled=true;$('banner-status').textContent='帯を作成中…';
  try{const img=await loadBanner();if(current!==selected||$('banner-kind').value!==kind)return;
    const canvas=$('banner-preview');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0);
    ctx.fillStyle='#fff';ctx.fillRect(1340,555,285,281);ctx.imageSmoothingEnabled=false;ctx.drawImage(paint(model,280),1342,555);
    $('banner-status').textContent=(selected.record.creator||selected.record.creator_key)+' / '+(kind==='normal'?'通常URL':'ディープリンク')+' のQRを配置しました。';$('banner-download').disabled=false;
  }catch(e){if(current===selected)$('banner-status').textContent=e.message;}
}
$('banner-kind').onchange=renderBanner;
$('banner-download').onclick=()=>{if(!current||$('banner-download').disabled)return;const selected=current,kind=$('banner-kind').value;$('banner-preview').toBlob(blob=>{if(!blob){message('帯のPNGを作成できませんでした。');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=selected.adgroup.replace(/[^A-Za-z0-9_-]/g,'_')+'_'+kind+'_frame.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');};

refreshSheet();
