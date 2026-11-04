/* Read only the URL作成 worksheet from an OOXML .xlsx/.xlsm file, locally. */
(function(root){
  'use strict';
  const decoder=new TextDecoder();
  async function unzip(buffer){
    const data=new Uint8Array(buffer),view=new DataView(buffer);let end=-1;
    for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===data.length){end=i;break;}
    if(end<0)throw Error('Excelファイルを読み取れません。.xlsx / .xlsmを選択してください。');
    const entries=new Map(),count=view.getUint16(end+10,true);let pos=view.getUint32(end+16,true);
    for(let i=0;i<count;i++){
      if(pos+46>data.length||view.getUint32(pos,true)!==0x02014b50)throw Error('Excelファイルの構造が不正です。');
      const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true),size=view.getUint32(pos+20,true),rawSize=view.getUint32(pos+24,true),nl=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true);
      const name=decoder.decode(data.subarray(pos+46,pos+46+nl));entries.set(name,{flags,method,size,rawSize,offset});pos+=46+nl+extra+comment;
    }
    return async name=>{
      const e=entries.get(name);if(!e)return null;
      if(e.flags&1||e.rawSize>30*1024*1024)throw Error('暗号化または大きすぎるExcelには対応していません。');
      const o=e.offset;if(o+30>data.length||view.getUint32(o,true)!==0x04034b50)throw Error('Excelファイルが破損しています。');
      const start=o+30+view.getUint16(o+26,true)+view.getUint16(o+28,true);if(start+e.size>data.length)throw Error('Excelファイルが破損しています。');
      const bytes=data.subarray(start,start+e.size);let result;
      if(e.method===0)result=bytes;
      else if(e.method===8){
        if(typeof DecompressionStream==='undefined')throw Error('このブラウザではExcelを解凍できません。最新版のChrome / Edgeを使用してください。');
        const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),chunks=[];let total=0;
        try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>30*1024*1024)throw Error('Excelの展開サイズが大きすぎます。');chunks.push(value);}}finally{await reader.cancel();}
        result=new Uint8Array(total);let at=0;for(const c of chunks){result.set(c,at);at+=c.length;}
      }else throw Error('このExcelの圧縮形式には対応していません。');
      if(result.length!==e.rawSize)throw Error('Excelファイルが破損しています。');return decoder.decode(result);
    };
  }
  function xml(text){if(!text)throw Error('必要なExcelデータがありません。');const d=new DOMParser().parseFromString(text,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('ExcelのXMLが不正です。');return d;}
  const all=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
  function safeURL(value){try{const u=new URL(value);return u.origin==='https://h5.g123.jp'&&/^\/game\/[a-z0-9-]+$/.test(u.pathname)&&u.searchParams.get('utm_source')==='Influencer';}catch{return false;}}
  async function read(buffer){
    const get=await unzip(buffer),book=xml(await get('xl/workbook.xml')),rels=xml(await get('xl/_rels/workbook.xml.rels'));
    const sheet=all(book,'sheet').find(s=>s.getAttribute('name')==='URL作成');if(!sheet)throw Error('「URL作成」タブが見つかりません。');
    const id=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
    const relation=all(rels,'Relationship').find(r=>r.getAttribute('Id')===id);if(!relation||relation.getAttribute('TargetMode')==='External')throw Error('対象タブを読み取れません。');
    const target=relation.getAttribute('Target'),path=new URL(target,'https://excel.local/xl/').pathname.slice(1);
    const stringsText=await get('xl/sharedStrings.xml');
    const strings=stringsText?all(xml(stringsText),'si').map(s=>all(s,'t').map(t=>t.textContent).join('')):[];
    const doc=xml(await get(path)),rows=all(doc,'row').map(row=>{
      const values={};for(const cell of all(row,'c')){
        const column=(cell.getAttribute('r')||'').replace(/[0-9]/g,''),type=cell.getAttribute('t'),v=all(cell,'v')[0]?.textContent||'';
        values[column]=type==='s'?strings[Number(v)]||'':type==='inlineStr'?all(cell,'t').map(t=>t.textContent).join(''):v;
      }return values;
    });
    const headerIndex=rows.findIndex(r=>Object.values(r).includes('演者')&&Object.values(r).includes('URL'));
    if(headerIndex<0)throw Error('「演者」「URL」列が見つかりません。');
    const header=rows[headerIndex],column=label=>Object.keys(header).find(k=>header[k].trim()===label),col={creator:column('演者'),normal:column('URL'),agency:column('事務所'),id:column('ID'),title:column('title'),language:column('language')};
    const records=[];let skipped=0;
    for(let i=headerIndex+1;i<rows.length;i++){
      const r=rows[i],creator=(r[col.creator]||'').trim(),normal=(r[col.normal]||'').trim();
      if(!creator)continue;if(!safeURL(normal)){skipped++;continue;}
      const u=new URL(normal),id=(r[col.id]||'').replace(/\.0$/,'');
      records.push({creator,agency:r[col.agency]||'',id,title:r[col.title]||u.pathname.split('/').pop(),language:r[col.language]||u.searchParams.get('lang')||'',normal,deep:'https://auxin-admin.g123.jp/twitter_redirect.html?callback='+encodeURIComponent(normal),campaign:u.searchParams.get('utm_campaign')||'',adgroup:u.searchParams.get('utm_adgroup')||'',row:i+1});
    }
    if(!records.length)throw Error('演者名と有効な計測URLのある行がありません。Excelで再計算して保存したファイルを使用してください。');
    return {records,skipped};
  }
  root.CreatorSheet={read,unzip};if(typeof module!=='undefined')module.exports=root.CreatorSheet;
})(typeof window==='undefined'?globalThis:window);
