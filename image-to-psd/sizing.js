(function(root){
  'use strict';
  function outputSize(sourceWidth,sourceHeight,settings){
    const width=settings.preset==='original'?sourceWidth:Number(settings.width);
    const height=settings.preset==='original'?sourceHeight:Number(settings.height);
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>30000||height>30000||width*height>25000000)
      throw new Error('出力サイズは整数で各辺1〜30,000px、合計2,500万画素以内にしてください。');
    return{width,height};
  }
  function imagePlacement(sw,sh,dw,dh,fit){
    if(fit==='stretch')return{x:0,y:0,width:dw,height:dh};
    const scale=fit==='cover'?Math.max(dw/sw,dh/sh):Math.min(dw/sw,dh/sh);
    const width=sw*scale,height=sh*scale;
    return{x:(dw-width)/2,y:(dh-height)/2,width,height};
  }
  const api={outputSize,imagePlacement};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else Object.assign(root,api);
})(globalThis);
