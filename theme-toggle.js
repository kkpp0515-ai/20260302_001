(()=>{'use strict';
const root=document.documentElement;
try{root.dataset.theme=localStorage.getItem('neo-theme')==='light'?'light':'dark';}catch{root.dataset.theme='dark';}
document.addEventListener('DOMContentLoaded',()=>{
const style=document.createElement('style');style.textContent='.theme-toggle-btn{position:fixed;top:22px;right:24px;z-index:100000;width:40px;height:40px;display:grid;place-items:center;background:var(--card-bg);border:1px solid var(--border);color:var(--gold);font:20px Georgia,serif;cursor:pointer;border-radius:50%;transition:border-color .2s}.theme-toggle-btn:hover{border-color:var(--gold)}@media(max-width:768px){.theme-toggle-btn{top:13px;right:14px;width:36px;height:36px}}';document.head.appendChild(style);
const button=document.createElement('button');button.type='button';button.className='theme-toggle-btn';
const sync=()=>{const dark=root.dataset.theme==='dark';button.textContent=dark?'☼':'☾';button.title=dark?'ライトテーマに切り替え':'ダークテーマに切り替え';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(!dark));};
button.onclick=()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('neo-theme',root.dataset.theme);}catch{}sync();};
sync();document.body.appendChild(button);
});})();