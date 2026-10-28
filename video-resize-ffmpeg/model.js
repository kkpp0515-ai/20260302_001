(function(root){
'use strict';
const sizes={'1080x1080':{w:1080,h:1080,label:'正方形',ratio:'1:1'},'1920x1080':{w:1920,h:1080,label:'横長',ratio:'16:9'},'1080x1920':{w:1080,h:1920,label:'縦長',ratio:'9:16'}};
function jobs(languages,formats){return languages.flatMap(lang=>formats.map(size=>({lang,size})));}
function safeName(value){return value.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/\.+$/,'').trim()||'video';}
function filename(title,lang,base,size){return safeName(title+'_'+lang+'_'+base+'_'+size.replace('x','-'))+'.mp4';}
function fit(v,box,mode='height'){const scale=mode==='cover'?Math.max(box.w/v.w,box.h/v.h):mode==='contain'?Math.min(box.w/v.w,box.h/v.h):box.h/v.h;return {scale,x:box.x+(box.w-v.w*scale)/2,y:box.y+(box.h-v.h*scale)/2};}
function rect(v,p){return {x:p.x,y:p.y,w:v.w*p.scale,h:v.h*p.scale};}
function placementFilter(stage,v,p){
 const even=n=>Math.max(2,Math.round(n/2)*2),w=even(v.w*p.scale),h=even(v.h*p.scale),x=Math.round(p.x),y=Math.round(p.y);
 const left=Math.max(0,-x),top=Math.max(0,-y),cw=Math.min(w-left,stage.w-Math.max(0,x)),ch=Math.min(h-top,stage.h-Math.max(0,y));
 if(cw<1||ch<1)return 'scale=2:2,drawbox=color=black:t=fill,scale='+stage.w+':'+stage.h+',setsar=1,fps=30,format=yuv420p,settb=AVTB';
 return 'scale='+w+':'+h+',crop='+cw+':'+ch+':'+left+':'+top+':exact=1,pad='+stage.w+':'+stage.h+':'+Math.max(0,x)+':'+Math.max(0,y)+':black,setsar=1,fps=30,format=yuv420p,settb=AVTB';
}
function buildCommand({size,main,placement,end,box,band,mainAudio,endAudio}){
 const stage=sizes[size],args=['-y','-i','main.input'],f=[],d=main.duration,ed=end?end.duration:0;
 if(end)args.push('-i','end.input');if(band)args.push('-loop','1','-i','band.png');
 f.push('[0:v]trim=duration='+d+',setpts=PTS-STARTPTS,'+placementFilter(stage,main,placement)+'[mainv]');
 if(end){f.push('[1:v]trim=duration='+ed+',setpts=PTS-STARTPTS,'+placementFilter(stage,end,fit(end,box,'contain'))+'[endv]');f.push('[mainv][endv]concat=n=2:v=1:a=0[base]');}else f.push('[mainv]null[base]');
 f.push(band?'[base]['+(end?2:1)+':v]overlay=0:0:shortest=1:format=auto,format=yuv420p[outv]':'[base]null[outv]');
 const audio=(i,present,dur,label)=>present?'['+i+':a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS,apad,atrim=duration='+dur+'['+label+']':'anullsrc=r=48000:cl=stereo,atrim=duration='+dur+'['+label+']';
 f.push(audio(0,mainAudio,d,'ma'));
 if(end){f.push(audio(1,endAudio,ed,'ea'));f.push('[ma][ea]concat=n=2:v=0:a=1[outa]');}else f.push('[ma]anull[outa]');
 args.push('-filter_complex_threads','1','-filter_complex',f.join(';'),'-map','[outv]','-map','[outa]','-t',String(d+ed),'-c:v','libx264','-preset','veryfast','-b:v','3200k','-maxrate','4800k','-bufsize','6400k','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','output.mp4');return args;
}
const api={sizes,jobs,filename,fit,rect,placementFilter,buildCommand};
if(typeof module==='object'&&module.exports)module.exports=api;else root.ResizeModel=api;
})(globalThis);
