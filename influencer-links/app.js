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
const bannerTemplates={witch:{file:'scimagic-frame-witch.png',label:'魔女'},original:{file:'scimagic-frame.png',label:'紫髪'}};
const bannerImagePromises={};

const customBanners = new Map();
const design = $('banner-template');
const builtinOptions = Array.from(design.options);
const placeholder = new Option('帯画像を追加してください', '');
design.append(placeholder);
const bannerFile = $('banner-file');
let dbPromise;
function bannerDB() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('creator-links-custom-banners', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images', {keyPath:'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => { dbPromise = null; throw error; });
  return dbPromise;
}
async function storedBanners(mode, action) {
  const db = await bannerDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', mode);
    const request = action(tx.objectStore('images'));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error);
  });
}
function addOption(record) {
  customBanners.set(record.id, record);
  design.add(new Option(record.name, record.id));
}
const restoreBanners = storedBanners('readonly', store => store.getAll()).then(records => {
  records.forEach(addOption);
  renderBanner();
}).catch(() => { $('upload-status').textContent = 'ブラウザの帯画像保存領域を開けませんでした。'; });
bannerFile.onchange = async () => {
  const file = bannerFile.files[0];
  if (!file) return;
  bannerFile.disabled = true;
  const url = URL.createObjectURL(file);
  try {
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw Error('PNG・JPEG・WebPの画像を選んでください。');
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => { throw Error('画像を読み込めませんでした。'); });
    const size = Math.round(Math.min(img.width,img.height) * 0.3);
    const record = { id:'custom-'+crypto.randomUUID(), name:file.name, file, size:Math.max(1,size), x:img.width-size, y:img.height-size };
    await restoreBanners;
    await storedBanners('readwrite', store => store.add(record));
    addOption(record);
    design.value = record.id;
    $('upload-status').textContent = file.name+' を追加しました。';
    renderBanner();
  } catch (error) { $('upload-status').textContent = '追加できませんでした。'+error.message; }
  finally { URL.revokeObjectURL(url); bannerFile.disabled = false; bannerFile.value = ''; }
};
$('custom-remove').onclick = async () => {
  const record = customBanners.get(design.value);
  if (!record || !confirm(record.name+' をこのブラウザの帯一覧から削除しますか？')) return;
  try {
    await storedBanners('readwrite', store => store.delete(record.id));
    customBanners.delete(record.id);
    design.querySelector('[value="'+record.id+'"]').remove();
    if (bannerImagePromises[record.id]) delete bannerImagePromises[record.id];
    $('upload-status').textContent = record.name+' を削除しました。';
    renderBanner();
  } catch { $('upload-status').textContent = '削除できませんでした。'; }
};
function savePlacement(record) {
  storedBanners('readwrite', store => store.put(record)).catch(() => {
    $('upload-status').textContent = 'QR位置を保存できませんでした。';
  });
  renderBanner();
}
$('custom-size').onchange = () => {
  const record = customBanners.get(design.value);
  const size = $('custom-size').valueAsNumber;
  if (!record) return;
  if ($('custom-size').validity.valid && Number.isInteger(size)) {
    record.size = size;
    savePlacement(record);
  } else renderBanner();
};
$('banner-preview').onclick = event => {
  const record = customBanners.get(design.value);
  if (!record || $('banner-download').disabled) return;
  const canvas = event.currentTarget, rect = canvas.getBoundingClientRect();
  record.size = $('custom-size').valueAsNumber;
  record.x = Math.round((event.clientX-rect.left)*canvas.width/rect.width-record.size/2);
  record.y = Math.round((event.clientY-rect.top)*canvas.height/rect.height-record.size/2);
  savePlacement(record);
};

function loadBanner(template){if(!bannerImagePromises[template])bannerImagePromises[template]=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>{delete bannerImagePromises[template];reject(Error('帯テンプレートを読み込めませんでした。再度帯を選択してください。'));};const record=customBanners.get(template);
    if(record){
      const url=URL.createObjectURL(record.file);
      img.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});
      img.addEventListener('error',()=>URL.revokeObjectURL(url),{once:true});
      img.src=url;
    }else img.src=bannerTemplates[template].file;});return bannerImagePromises[template];}
async function renderBanner(){
  if(!current)return;
  const sciMagic=current.record.title==='scimagic';
  for(const option of builtinOptions) option.disabled=option.hidden=!sciMagic;
  placeholder.disabled=placeholder.hidden=sciMagic;
  if(!design.value || design.selectedOptions[0]?.disabled) design.value=sciMagic?builtinOptions[0].value:(customBanners.keys().next().value||'');
  const custom=customBanners.get(design.value);
  $('custom-controls').hidden=!custom;
  const selected=current,kind=$('banner-kind').value,template=$('banner-template').value,model=models[kind];$('banner-section').hidden=false;$('banner-download').disabled=true;$('banner-status').textContent='帯を作成中…';
  if(!template){$('banner-preview').style.display='none';$('banner-status').textContent='使用する帯画像を追加してください。';return;}
  $('banner-preview').style.display='block';
  try{const img=await loadBanner(template);if(current!==selected||$('banner-kind').value!==kind||$('banner-template').value!==template)return;
    const canvas=$('banner-preview');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0);
    if(custom){
      const minSize=model.getModuleCount()+8, maxSize=Math.min(canvas.width,canvas.height);
      if(maxSize<minSize)throw Error('このQRを配置するには画像が小さすぎます。');
      const size=Math.min(maxSize,Math.max(minSize,custom.size));
      const x=Math.max(0,Math.min(canvas.width-size,custom.x)), y=Math.max(0,Math.min(canvas.height-size,custom.y));
      Object.assign($('custom-size'),{min:minSize,max:maxSize,value:size});
      ctx.drawImage(paint(model,size),x,y);
    }else{
    ctx.fillStyle='#fff';ctx.fillRect(1340,555,285,281);ctx.imageSmoothingEnabled=false;ctx.drawImage(paint(model,280),1342,555);
    }
    $('banner-download').textContent='QR入り配信帯をPNG保存（'+canvas.width+' × '+canvas.height+'）';
    $('banner-status').textContent=(selected.record.creator||selected.record.creator_key)+' / '+(kind==='normal'?'通常URL':'ディープリンク')+' / '+(custom?custom.name:bannerTemplates[template].label)+'の帯にQRを配置しました。';$('banner-download').disabled=false;
  }catch(e){if(current===selected && design.value===template && $('banner-kind').value===kind)$('banner-status').textContent=e.message;}
}
$('banner-kind').onchange=renderBanner;
$('banner-template').onchange=renderBanner;
$('banner-download').onclick=()=>{if(!current||$('banner-download').disabled)return;const selected=current,kind=$('banner-kind').value,template=$('banner-template').value;$('banner-preview').toBlob(blob=>{if(!blob){message('帯のPNGを作成できませんでした。');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=selected.adgroup.replace(/[^A-Za-z0-9_-]/g,'_')+'_'+kind+'_'+template+'_frame.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');};

refreshSheet();
