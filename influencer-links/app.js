'use strict';
const $=id=>document.getElementById(id),form=$('record-form');
let current=null,models={};
function message(text){$('message').textContent=text;}
function hideResult(){current=null;models={};$('links').hidden=true;$('preview-note').hidden=false;}
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
function showQR(){for(const kind of ['normal','deep']){const canvas=paint(models[kind],Number($('qr-size').value));canvas.setAttribute('role','img');canvas.setAttribute('aria-label',kind==='normal'?'通常URLのQRコード':'ディープリンクのQRコード');$(kind+'-qr').replaceChildren(canvas);}}
function generate(){
  hideResult();const record=getRecord(),result=CreatorLinks.links(record);
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
