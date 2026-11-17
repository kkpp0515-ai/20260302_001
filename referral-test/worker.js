// Referral Test API - independent from the LINE priority-review bot.
// Worker name: referral-test-api
// D1 binding: DB
// Plain variable: LINE_LOGIN_CHANNEL_ID (see LINE Login channel basic settings)
// Secret: REFERRAL_HASH_SECRET (random value with >= 32 bytes of entropy)
const ALLOWED_ORIGIN = "https://kkpp0515-ai.github.io";
const MAX_BODY_BYTES = 6000;
const CODE_RE = /^[A-Za-z0-9_-]{16,24}$/;

function headers(origin) {
  const h = {
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",
    "Vary":"Origin"
  };
  if (origin === ALLOWED_ORIGIN) {
    h["Access-Control-Allow-Origin"]=origin;
    h["Access-Control-Allow-Methods"]="POST, OPTIONS";
    h["Access-Control-Allow-Headers"]="Content-Type";
  }
  return h;
}
function json(body,status,origin) {
  return new Response(JSON.stringify(body),{
    status:status||200,headers:headers(origin)
  });
}
function randomCode() {
  const a=crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...a))
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function userKey(sub,secret) {
  const key=await crypto.subtle.importKey(
    "raw",new TextEncoder().encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]
  );
  const signed=await crypto.subtle.sign(
    "HMAC",key,new TextEncoder().encode(sub)
  );
  return Array.from(new Uint8Array(signed))
    .map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function verifyLineIdToken(idToken,channelId) {
  const payload=new URLSearchParams({
    id_token:idToken,client_id:channelId
  });
  const response=await fetch("https://api.line.me/oauth2/v2.1/verify",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:payload
  });
  if(!response.ok)return null;
  const data=await response.json();
  if(!data.sub||data.aud!==channelId||
      data.iss!=="https://access.line.me" ||
      !Number.isFinite(data.exp) || data.exp<=Date.now()/1000){
    return null;
  }
  return data.sub;
}
async function handleRegister(request,env,origin){
  if(!env.DB||!env.LINE_LOGIN_CHANNEL_ID||!env.REFERRAL_HASH_SECRET){
    return json({error:"サーバー設定が不足しています（D1・チャネルID・Secret）"},503,origin);
  }
  let body;
  try{
    const raw=await request.text();
    if(raw.length>MAX_BODY_BYTES)return json({error:"リクエストが大きすぎます"},413,origin);
    body=JSON.parse(raw);
  }catch{
    return json({error:"JSONが不正です"},400,origin);
  }
  if(!body||typeof body.idToken!=="string"||
      body.idToken.length<50||body.idToken.length>5000){
    return json({error:"LINEログインが必要です"},400,origin);
  }
  const ref=typeof body.ref==="string"&&CODE_RE.test(body.ref) ? body.ref : null;
  // Never accept a client-provided LINE user ID or profile to authenticate.
  // Verify the raw ID token with LINE before touching D1.
  let sub;
  try{
    sub=await verifyLineIdToken(body.idToken,String(env.LINE_LOGIN_CHANNEL_ID));
  }catch{
    return json({error:"LINE認証サーバーに接続できません"},502,origin);
  }
  if(!sub)return json({error:"LINE認証に失敗しました。再ログインしてください"},401,origin);
  const me=await userKey(sub,env.REFERRAL_HASH_SECRET);
  try {
    const existing=await env.DB.prepare(
      "SELECT referral_code FROM users WHERE user_key=?"
    ).bind(me).first();
    let justRegistered=false;
    if(!existing){
      let inviter=null;
      if(ref){
        const row=await env.DB.prepare(
          "SELECT user_key FROM users WHERE referral_code=?"
        ).bind(ref).first();
        if(row&&row.user_key!==me)inviter=row.user_key;
      }
      const code=randomCode();
      const result=await env.DB.prepare(
        "INSERT OR IGNORE INTO users (user_key,referral_code,referred_by) VALUES (?,?,?)"
      ).bind(me,code,inviter).run();
      justRegistered=!!result.meta?.changes;
    }
    const mine=await env.DB.prepare(
      "SELECT referral_code,referred_by FROM users WHERE user_key=?"
    ).bind(me).first();
    if(!mine)return json({error:"登録情報を取得できませんでした"},500,origin);
    const total=await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM users WHERE referred_by=?"
    ).bind(me).first();
    return json({
      ok:true,
      justRegistered,
      referralCode:mine.referral_code,
      referralCount:Number(total.count)||0,
      registeredViaReferral:!!mine.referred_by
    },200,origin);
  }catch(err){
    // Avoid logging LINE tokens, IDs, database details or any personal data.
    console.error("D1 registration failed");
    return json({error:"登録データベースでエラーが発生しました"},500,origin);
  }
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const origin=request.headers.get("Origin")||"";
    if(url.pathname==="/health"&&request.method==="GET"){
      return json({ok:true,service:"referral-test-api"},200,origin);
    }
    if(url.pathname!=="/register")
      return json({error:"Not Found"},404,origin);
    if(request.method==="OPTIONS")
      return new Response(null,{
        status:origin===ALLOWED_ORIGIN?204:403,
        headers:headers(origin)
      });
    if(request.method!=="POST")
      return json({error:"Method Not Allowed"},405,origin);
    if(origin!==ALLOWED_ORIGIN)
      return json({error:"Forbidden"},403,origin);
    return handleRegister(request,env,origin);
  }
};