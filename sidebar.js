document.addEventListener('DOMContentLoaded', () => {
    // Get the base path based on the script src
    const currentScript = document.currentScript || document.querySelector('script[src*="sidebar.js"]');
    const scriptSrc = currentScript ? currentScript.getAttribute('src') : '';
    const basePath = scriptSrc.startsWith('../') ? '../' : './';

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
.portal-sidebar{position:fixed;left:0;top:0;bottom:0;width:250px;background:var(--bg);border-right:1px solid var(--border);color:var(--text);padding:30px 0 22px;z-index:99999;overflow-y:auto;font-family:"Yu Gothic",Meiryo,sans-serif;transition:transform .2s}
.portal-sidebar-header{padding:0 24px 24px;border-bottom:1px solid var(--border);margin-bottom:18px}
.portal-sidebar-header h2{font:19px/1.55 Georgia,serif;color:var(--gold);letter-spacing:.09em;margin:0}
.portal-sidebar-header h2::before{content:'✧';display:block;font:28px Georgia;margin-bottom:10px}
.portal-sidebar-header h2::after{content:'CREATIVE WORKSPACE';display:block;font:9px/2 sans-serif;letter-spacing:.18em;color:var(--muted);margin-top:7px}
.portal-sidebar-list{list-style:none;padding:0 12px;margin:0}.portal-sidebar-list li{margin:3px 0}
.portal-sidebar-list a{display:flex;align-items:center;padding:11px 12px;color:var(--muted);text-decoration:none;gap:11px;font-size:12px;font-weight:500;line-height:1.6;border:1px solid transparent;border-radius:3px;transition:background .2s,color .2s}
.portal-sidebar-list a:hover,.portal-sidebar-list a[aria-current="page"]{background:var(--hover-bg);color:var(--gold);border-color:var(--border)}
.portal-sidebar-icon{font-size:15px;width:23px;text-align:center;flex-shrink:0;opacity:.85}
body{padding-left:270px!important}
.portal-menu-toggle{display:none}
@media(max-width:768px){.portal-sidebar{transform:translateX(-100%);width:270px;padding-top:66px;box-shadow:15px 0 60px #0005}.portal-sidebar.is-open{transform:translateX(0)}body{padding-left:0!important}.portal-menu-toggle{position:fixed;top:13px;left:14px;width:36px;height:36px;border:1px solid var(--border);border-radius:3px;background:var(--card-bg);color:var(--gold);z-index:100000;display:grid;place-items:center;font-size:19px;cursor:pointer}}
`;
    document.head.appendChild(style);

    // Inject Sidebar DOM
    const sidebar = document.createElement('div');
    sidebar.className = 'portal-sidebar';
    sidebar.innerHTML = `
        <div class="portal-sidebar-header">
            <a href="${basePath}index.html" style="text-decoration:none;">
                <h2>CTW Marketing Ai Tool</h2>
            </a>
        </div>
        <ul class="portal-sidebar-list">
<li><a href="${basePath}video-resize-ffmpeg/index.html"><span class="portal-sidebar-icon">✂️</span><span>動画リサイズ FFmpeg版</span></a></li>
            <li><a href="${basePath}influencer-video-ffmpeg/index.html"><span class="portal-sidebar-icon">🎬</span><span>動画合成 FFmpeg版</span></a></li>
            <li><a href="${basePath}image-to-psd/index.html"><span class="portal-sidebar-icon">🗂️</span><span>画像 → PSD変換</span></a></li>
            
            <li>
                <a href="${basePath}square-resize-tool/index.html">
                    <span class="portal-sidebar-icon">↗️</span>
                    <span>1080 → 1200 一括変換</span>
                </a>
            </li>
            <li>
                <a href="${basePath}index.html">
                    <span class="portal-sidebar-icon">🏠</span>
                    <span>Home / Portal</span>
                </a>
            </li>
            
            
            <li>
                <a href="${basePath}tif2jpg/index.html">
                    <span class="portal-sidebar-icon">📸</span>
                    <span>TIFF to JPEG Converter</span>
                </a>
            </li>
            <li>
                <a href="${basePath}banner-rating-adder/index.html">
                    <span class="portal-sidebar-icon">🏷️</span>
                    <span>Banner Rating Adder</span>
                </a>
            </li>
            <li>
                <a href="${basePath}interactive-image-distorter/index.html">
                    <span class="portal-sidebar-icon">🍮</span>
                    <span>揺れプリン</span>
                </a>
            </li>
            <li>
                <a href="${basePath}weekly-planning-tool/index.html">
                    <span class="portal-sidebar-icon">📊</span>
                    <span>週間企画数割り振り</span>
                </a>
            </li>
            
            <li>
                <a href="${basePath}pixivads/index.html">
                    <span class="portal-sidebar-icon">📝</span>
                    <span>Pixiv広告CSV生成</span>
                </a>
            </li>
            <li>
                <a href="${basePath}image-watermark-tool/index.html">
                    <span class="portal-sidebar-icon">©️</span>
                    <span>Image Watermark Tool</span>
                </a>
            </li>
            <li>
                <a href="${basePath}gradient-mask-tool/index.html">
                    <span class="portal-sidebar-icon">🌓</span>
                    <span>Gradient Mask Tool</span>
                </a>
            </li>
            <li>
                <a href="${basePath}banner_ai_generator/index.html">
                    <span class="portal-sidebar-icon">🎨</span>
                    <span>Ad Banner AI Generator</span>
                </a>
            </li>
            <li>
                <a href="${basePath}line-flex-sender/index.html">
                    <span class="portal-sidebar-icon">💬</span>
                    <span>LINE Flex Sender</span>
                </a>
            </li>
        </ul>
    `;
    sidebar.id='portal-navigation';sidebar.setAttribute('role','navigation');sidebar.setAttribute('aria-label','ツール一覧');
    const normalize=path=>{let p=path.endsWith('index.html')?path.slice(0,-10):path;return p.endsWith('/')?p.slice(0,-1):p;};
    sidebar.querySelectorAll('a').forEach(a=>{if(normalize(new URL(a.href).pathname)===normalize(location.pathname))a.setAttribute('aria-current','page');});
    const menu=document.createElement('button');menu.type='button';menu.className='portal-menu-toggle';menu.textContent='☰';menu.setAttribute('aria-label','ツールメニューを開く');menu.setAttribute('aria-controls',sidebar.id);menu.setAttribute('aria-expanded','false');
    const close=()=>{sidebar.classList.remove('is-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','ツールメニューを開く');};
    menu.onclick=()=>{const open=sidebar.classList.toggle('is-open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'ツールメニューを閉じる':'ツールメニューを開く');};
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    document.addEventListener('click',e=>{if(!sidebar.contains(e.target)&&!menu.contains(e.target))close();});
    document.body.prepend(sidebar,menu);
});
