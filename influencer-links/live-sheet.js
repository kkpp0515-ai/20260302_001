(function(root){
  'use strict';
  const SHEET_ID='1BpCimON8KPZRWrZ1iqnewk7DNvq00Mki',GID='1112039073';
  function parse(response){
    if(response?.status!=='ok'||!response.table)throw Error('スプレッドシートを取得できません。共有設定と「URL作成」タブを確認してください。');
    const {cols,rows}=response.table,index=name=>cols.findIndex(c=>c.label?.trim()===name),positions={creator:index('演者'),normal:index('URL'),agency:index('事務所'),id:index('ID'),title:index('title'),language:index('language')};
    if(positions.creator<0||positions.normal<0)throw Error('「演者」「URL」列が見つかりません。');
    const records=[];let skipped=0;
    for(const row of rows){
      const value=key=>String(row.c?.[positions[key]]?.v??'').trim(),creator=value('creator'),normal=value('normal');if(!creator)continue;
      let u;try{u=new URL(normal);if(u.origin!=='https://h5.g123.jp'||!/^\/game\/[a-z0-9-]+$/.test(u.pathname)||u.searchParams.get('utm_source')!=='Influencer')throw Error();}catch{skipped++;continue;}
      const adgroup=u.searchParams.get('utm_adgroup')||'',title=value('title')||u.pathname.split('/').pop();
      // A mixed-type ID column can lose text IDs in gviz; recover the exact ID from tracking data.
      const prefix='crt_'+title+'_',tail=adgroup.startsWith(prefix)?adgroup.slice(prefix.length):'',id=value('id')||tail.split('_')[0];
      records.push({creator,agency:value('agency'),id,title,language:value('language')||u.searchParams.get('lang')||'',normal,deep:'https://auxin-admin.g123.jp/twitter_redirect.html?callback='+encodeURIComponent(normal),campaign:u.searchParams.get('utm_campaign')||'',adgroup});
    }
    if(!records.length)throw Error('演者名と有効な計測URLのある行がありません。');return {records,skipped};
  }
  let serial=0;
  function read(){return new Promise((resolve,reject)=>{
    const callback='creatorSheet_'+Date.now()+'_'+(++serial),script=document.createElement('script');let timer;
    const cleanup=()=>{clearTimeout(timer);script.remove();delete root[callback];};
    root[callback]=response=>{cleanup();try{resolve(parse(response));}catch(e){reject(e);}};
    script.onerror=()=>{cleanup();reject(Error('スプレッドシートに接続できません。通信状態と共有設定を確認して「一覧を更新」を押してください。'));};
    timer=setTimeout(()=>{cleanup();reject(Error('読み込みがタイムアウトしました。「一覧を更新」で再試行してください。'));},20000);
    const url=new URL('https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq');
    url.searchParams.set('gid',GID);url.searchParams.set('headers','1');url.searchParams.set('tq','select A,B,C,D,G,K where G is not null and K is not null');
    url.searchParams.set('tqx','out:json;responseHandler:'+callback);url.searchParams.set('_',String(Date.now()));script.src=url.href;document.head.append(script);
  });}
  root.CreatorLiveSheet={read,parse};if(typeof module!=='undefined')module.exports=root.CreatorLiveSheet;
})(typeof window==='undefined'?globalThis:window);
