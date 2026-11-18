import assert from "node:assert/strict";
import test from "node:test";
import worker from "./worker.js";

const users=new Map();
const friendships=new Map();
const secret="local-test-secret-is-long-enough-for-hmac";
const channel="2012656044";
const idToken=(id)=>"id-"+id+"-"+"a".repeat(60);
const accessToken=(id)=>"access-"+id+"-"+"b".repeat(60);
const idFromToken=(token,prefix)=>token.split("-")[1];
const mockJson=(body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{"Content-Type":"application/json"}
});

globalThis.fetch=async(url,options={})=>{
  const parsed=new URL(url);
  if(parsed.pathname==="/oauth2/v2.1/verify"&&options.method==="POST"){
    const id=idFromToken(new URLSearchParams(options.body).get("id_token"),"id");
    return mockJson({sub:"U"+id,aud:channel,iss:"https://access.line.me",exp:Date.now()/1000+3600});
  }
  if(parsed.pathname==="/oauth2/v2.1/verify"){
    return mockJson({scope:"openid profile",client_id:channel,expires_in:3600});
  }
  if(parsed.pathname==="/v2/profile"){
    const id=idFromToken(options.headers.Authorization.slice(7),"access");
    return mockJson({userId:"U"+id});
  }
  if(parsed.pathname==="/friendship/v1/status"){
    const id=idFromToken(options.headers.Authorization.slice(7),"access");
    return mockJson({friendFlag:friendships.get(id)===true});
  }
  throw new Error("Unexpected LINE endpoint: "+url);
};

const db={
  prepare(sql){
    return {bind(...args){return {
      async first(){
        if(sql.startsWith("SELECT referral_code FROM users")){
          return users.get(args[0])||null;
        }
        if(sql.startsWith("SELECT user_key FROM users WHERE referral_code")){
          return [...users.values()].find(row=>row.referral_code===args[0])||null;
        }
        if(sql.startsWith("SELECT referral_code,referred_by,friend_confirmed_at")){
          return users.get(args[0])||null;
        }
        if(sql.startsWith("SELECT COUNT(*)")){
          return {count:[...users.values()].filter(row=>row.referred_by===args[0]&&row.friend_confirmed_at).length};
        }
        throw new Error("Unexpected SELECT: "+sql);
      },
      async run(){
        if(sql.startsWith("INSERT OR IGNORE")){
          if(users.has(args[0]))return {meta:{changes:0}};
          users.set(args[0],{user_key:args[0],referral_code:args[1],referred_by:args[2],friend_confirmed_at:null});
          return {meta:{changes:1}};
        }
        if(sql.startsWith("UPDATE users SET friend_confirmed_at")){
          const row=users.get(args[0]);
          if(row&&!row.friend_confirmed_at)row.friend_confirmed_at=new Date().toISOString();
          return {meta:{changes:1}};
        }
        throw new Error("Unexpected RUN: "+sql);
      }
    };}};
  }
};
const env={DB:db,LINE_LOGIN_CHANNEL_ID:channel,REFERRAL_HASH_SECRET:secret};

async function register(id,ref=null,extras={}){
  const req=new Request("https://referral-test-api.kkpp0515.workers.dev/register",{
    method:"POST",headers:{"Origin":"https://g123.jp","Content-Type":"application/json"},
    body:JSON.stringify({idToken:idToken(id),accessToken:accessToken(id),ref,...extras})
  });
  const response=await worker.fetch(req,env);
  return {status:response.status,data:await response.json()};
}

test("referrals remain pending until LINE confirms the account is a friend",async()=>{
  friendships.set("inviter",true);
  const inviter=await register("inviter");
  assert.equal(inviter.status,200);
  friendships.set("invitee",false);
  const pending=await register("invitee",inviter.data.referralCode,{friendFlag:true});
  assert.equal(pending.status,200);
  assert.equal(pending.data.referralQualified,false);
  assert.equal((await register("inviter")).data.referralCount,0);
  friendships.set("invitee",true);
  const confirmed=await register("invitee");
  assert.equal(confirmed.data.referralQualified,true);
  assert.equal((await register("inviter")).data.referralCount,1);
  assert.equal((await register("invitee")).data.referralQualified,true);
  assert.equal((await register("inviter")).data.referralCount,1);
});

test("repeated visits and other referral codes cannot count the same invitee twice",async()=>{
  friendships.set("other",true);
  const other=await register("other");
  const invitee=await register("invitee",other.data.referralCode);
  assert.equal(invitee.data.registeredViaReferral,true);
  assert.equal((await register("other")).data.referralCount,0);
});

test("mismatched LINE access-token identity is rejected",async()=>{
  const req=new Request("https://referral-test-api.kkpp0515.workers.dev/register",{
    method:"POST",headers:{"Origin":"https://g123.jp","Content-Type":"application/json"},
    body:JSON.stringify({idToken:idToken("inviter"),accessToken:accessToken("invitee")})
  });
  const response=await worker.fetch(req,env);
  assert.equal(response.status,401);
});
