document.addEventListener('DOMContentLoaded', () => {
    // Get the base path based on the script src
    const currentScript = document.currentScript || document.querySelector('script[src$="sidebar.js"]');
    const scriptSrc = currentScript ? currentScript.getAttribute('src') : '';
    const basePath = scriptSrc.startsWith('../') ? '../' : './';

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
        .portal-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            width: 250px;
            background: var(--bg);
            border-right: 4px solid var(--border);
            color: var(--text);
            padding: 24px 0;
            z-index: 99999;
            overflow-y: auto;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            box-shadow: 6px 0 0 var(--shadow);
            transition: transform 0.3s ease, background-color 0.3s, color 0.3s;
        }
        .portal-sidebar-header {
            padding: 0 24px 20px;
            border-bottom: 4px solid var(--border);
            margin-bottom: 20px;
        }
        .portal-sidebar-header h2 {
            margin: 0;
            font-size: 1.2rem;
            font-weight: 800;
            color: var(--text);
            text-transform: uppercase;
        }
        .portal-sidebar-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .portal-sidebar-list li {
            margin: 0;
        }
        .portal-sidebar-list a {
            display: flex;
            align-items: center;
            padding: 12px 24px;
            color: var(--text);
            text-decoration: none;
            transition: all 0.2s;
            gap: 12px;
            font-size: 0.95rem;
            font-weight: bold;
            border-bottom: 2px solid transparent;
        }
        .portal-sidebar-list a:hover {
            background: var(--hover-bg);
            border-bottom: 2px solid var(--border);
        }
        .portal-sidebar-icon {
            font-size: 1.25rem;
            width: 24px;
            text-align: center;
        }
        /* Adjust body to prevent overlap */
        body {
            padding-left: 270px !important;
        }
        @media (max-width: 768px) {
            .portal-sidebar {
                transform: translateX(-100%);
            }
            body {
                padding-left: 0 !important;
            }
        }
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
            <li>
                <a href="${basePath}index.html">
                    <span class="portal-sidebar-icon">🏠</span>
                    <span>Home / Portal</span>
                </a>
            </li>
            <li>
                <a href="${basePath}video_resize_tool/index.html">
                    <span class="portal-sidebar-icon">✂️</span>
                    <span>動画リサイズ＆帯合成</span>
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
                <a href="${basePath}chromakey_compositor/ChromaKey Compositor.html">
                    <span class="portal-sidebar-icon">🎨</span>
                    <span>ChromaKey Compositor</span>
                </a>
            </li>
        </ul>
    `;
    document.body.prepend(sidebar);
});
