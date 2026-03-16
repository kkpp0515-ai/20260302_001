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
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(10px);
            border-right: 1px solid rgba(255, 255, 255, 0.1);
            color: #fff;
            padding: 24px 0;
            z-index: 99999;
            overflow-y: auto;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            box-shadow: 2px 0 10px rgba(0,0,0,0.3);
            transition: transform 0.3s ease;
        }
        .portal-sidebar-header {
            padding: 0 24px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            margin-bottom: 20px;
        }
        .portal-sidebar-header h2 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 700;
            background: linear-gradient(to right, #818cf8, #f472b6);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
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
            color: #cbd5e1;
            text-decoration: none;
            transition: all 0.2s;
            gap: 12px;
            font-size: 0.9rem;
        }
        .portal-sidebar-list a:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
            border-left: 3px solid #818cf8;
            padding-left: 21px;
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
        </ul>
    `;
    document.body.prepend(sidebar);
});
