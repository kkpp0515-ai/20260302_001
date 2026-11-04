(function(root){
  'use strict';
  function validate(r){
    for(const k of ['id','title','language','agency_key','creator_key'])if(!String(r[k]||'').trim())throw Error('必須項目を入力してください。');
    if(!/^[a-z0-9-]{1,60}$/.test(r.title))throw Error('タイトルは半角英小文字・数字・ハイフンで入力してください。');
    if(!['ja','zh-TW','ko','en'].includes(r.language))throw Error('言語を選択してください。');
    if(!/^[A-Za-z0-9-]{1,40}$/.test(String(r.id)))throw Error('IDは40文字以内の半角英数字・ハイフンで入力してください。');
    for(const k of ['agency_key','creator_key'])if(!/^[A-Za-z0-9-]{1,80}$/.test(r[k]))throw Error('英字表記は80文字以内の半角英数字・ハイフンで入力してください。');
  }
  function links(r){
    validate(r);
    const campaign=`${r.title}_${r.language}_${r.agency_key}_Influencer_all`;
    const adgroup=`crt_${r.title}_${r.id}_${r.creator_key}`;
    const normal=`https://h5.g123.jp/game/${r.title}?utm_source=Influencer&utm_campaign=${encodeURIComponent(campaign)}&utm_adgroup=${encodeURIComponent(adgroup)}&lang=${encodeURIComponent(r.language)}`;
    return {campaign,adgroup,normal,deep:'https://auxin-admin.g123.jp/twitter_redirect.html?callback='+encodeURIComponent(normal)};
  }
  function parse(value){
    let u;try{u=new URL(value.trim());}catch{throw Error('有効なURLを入力してください。');}
    if(u.origin==='https://auxin-admin.g123.jp'&&u.pathname==='/twitter_redirect.html'){
      try{u=new URL(u.searchParams.get('callback'));}catch{throw Error('ディープリンクのcallbackが不正です。');}
    }
    if(u.origin!=='https://h5.g123.jp'||!/^\/game\/[a-z0-9-]+$/.test(u.pathname)||u.searchParams.get('utm_source')!=='Influencer')throw Error('G123のInfluencer計測URLを入力してください。');
    const title=u.pathname.split('/').pop(),language=u.searchParams.get('lang');
    const campaign=u.searchParams.get('utm_campaign')||'',adgroup=u.searchParams.get('utm_adgroup')||'';
    const prefix=`${title}_${language}_`,suffix='_Influencer_all',adprefix=`crt_${title}_`;
    if(!campaign.startsWith(prefix)||!campaign.endsWith(suffix)||!adgroup.startsWith(adprefix))throw Error('このツールの命名形式と一致しません。');
    const rest=adgroup.slice(adprefix.length),split=rest.indexOf('_');
    if(split<1)throw Error('アドグループのIDを読み取れません。');
    const result={title,language,agency_key:campaign.slice(prefix.length,-suffix.length),id:rest.slice(0,split),creator_key:rest.slice(split+1)};
    validate(result);return result;
  }
  const api={validate,links,parse};root.CreatorLinks=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
