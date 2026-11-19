(function(root){
'use strict';
const sizes={'1080x1080':{w:1080,h:1080,label:'正方形',ratio:'1:1'},'1920x1080':{w:1920,h:1080,label:'横長',ratio:'16:9'},'1080x1920':{w:1080,h:1920,label:'縦長',ratio:'9:16'}};
function randomId(){return globalThis.crypto.randomUUID().replace(/-/g,'');}
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
// ---- 分割エンコード（本編の映像だけ変換 → 保存済みフタ動画映像と無再エンコード連結）----
// エンコード設定を変えたら ENCODE_VERSION を上げる（保存済みフタ動画キャッシュが自動で無効になる）。
const ENCODE_VERSION='seg2';
// 本編側・フタ動画側で必ず同一の設定にする（連結時にコピーで繋ぐため、SPS/タイムスケール等を揃える必要がある）。
const VIDEO_ARGS=['-c:v','libx264','-preset','veryfast','-b:v','3200k','-maxrate','4800k','-bufsize','6400k','-pix_fmt','yuv420p','-video_track_timescale','15360'];
const AUDIO_ARGS=['-c:a','aac','-b:a','128k','-ar','48000','-ac','2'];
const audioPart=(i,present,dur,label)=>present?'['+i+':a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS,apad,atrim=duration='+dur+'['+label+']':'anullsrc=r=48000:cl=stereo,atrim=duration='+dur+'['+label+']';
// 1本の素材（本編 or フタ動画）を指定サイズのステージに配置し、帯を重ねた「映像のみ」の中間MP4にする。
function buildVideoSegmentCommand({size,input,media,placement,band,output}){
 const stage=sizes[size],d=media.duration,args=['-y','-i',input],f=[];
 if(band)args.push('-loop','1','-i','band.png');
 f.push('[0:v]trim=duration='+d+',setpts=PTS-STARTPTS,'+placementFilter(stage,media,placement)+'[basev]');
 f.push(band?'[basev][1:v]overlay=0:0:shortest=1:format=auto,format=yuv420p[outv]':'[basev]null[outv]');
 args.push('-filter_complex_threads','1','-filter_complex',f.join(';'),'-map','[outv]','-an','-t',String(d),...VIDEO_ARGS,output);
 return args;
}
// フタ動画の音声だけを取り出す（無音素材は無音で補う）。言語ごとに1つあればよく、サイズには依存しない。
function buildEndAudioCommand({input,duration,hasAudio,output='end_audio.wav'}){
 return ['-y','-i',input,'-filter_complex',audioPart(0,hasAudio,duration,'outa'),'-map','[outa]','-t',String(duration),'-c:a','pcm_s16le','-ar','48000','-ac','2',output];
}
// 本編映像＋フタ動画映像を連結（映像は再エンコードなし）。音声は元素材から1回だけ組み立てるので、連結部のズレや劣化がない。
function concatList(files){return files.map(f=>"file '"+f+"'").join('\n')+'\n';}
function buildFinalCommand({main,end,mainAudio,list='list.txt',endAudio='end_audio.wav',output='output.mp4'}){
 const f=[audioPart(1,mainAudio,main.duration,'ma'),audioPart(2,true,end.duration,'ea'),'[ma][ea]concat=n=2:v=0:a=1[outa]'];
 return ['-y','-f','concat','-safe','0','-i',list,'-i','main.input','-i',endAudio,'-filter_complex',f.join(';'),'-map','0:v:0','-map','[outa]','-t',String(main.duration+end.duration),'-c:v','copy',...AUDIO_ARGS,'-movflags','+faststart',output];
}
// 保存済みフタ動画（映像・音声）を再利用するためのキー。素材の指紋（ETag等）が変わると別キーになり、自動で作り直される。
function endVideoKey({title,lang,size,endcard,endcardFp,band,bandFp}){
 return ['v',ENCODE_VERSION,title,lang,size,endcard,endcardFp||'-',band?band:'noband',band?(bandFp||'-'):'-'].join('|');
}
function endAudioKey({title,lang,endcard,endcardFp}){
 return ['a',ENCODE_VERSION,title,lang,endcard,endcardFp||'-'].join('|');
}

const api={sizes,jobs,randomId,safeName,filename,fit,rect,placementFilter,buildCommand,ENCODE_VERSION,buildVideoSegmentCommand,buildEndAudioCommand,buildFinalCommand,concatList,endVideoKey,endAudioKey};
if(typeof module==='object'&&module.exports)module.exports=api;else root.ResizeModel=api;
})(globalThis);
