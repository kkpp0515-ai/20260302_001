// Theme Toggle Logic
document.addEventListener('DOMContentLoaded', () => {
    // Determine the base path correctly so the toggle button can find the root (for icons/etc if needed)
    const currentScript = document.currentScript || document.querySelector('script[src$="theme-toggle.js"]');
    const scriptSrc = currentScript ? currentScript.getAttribute('src') : '';
    const basePath = scriptSrc.startsWith('../') ? '../' : './';

    // Check local storage for theme
    const savedTheme = localStorage.getItem('neo-theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        // Default to light if not set
        document.documentElement.setAttribute('data-theme', 'light');
    }

    // Inject CSS for the toggle button
    const style = document.createElement('style');
    style.textContent = `
        .theme-toggle-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 100000;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background-color: var(--bg);
            border: 3px solid var(--border);
            color: var(--text);
            font-size: 20px;
            cursor: pointer;
            box-shadow: 4px 4px 0 var(--shadow);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }
        .theme-toggle-btn:hover {
            transform: translate(-2px, -2px);
            box-shadow: 6px 6px 0 var(--shadow);
            background-color: var(--text);
            color: var(--bg);
        }
        .theme-toggle-btn:active {
            transform: translate(2px, 2px);
            box-shadow: 2px 2px 0 var(--shadow);
        }
        /* Mobile adjustment */
        @media (max-width: 768px) {
            .theme-toggle-btn {
                top: 10px;
                right: 10px;
                width: 40px;
                height: 40px;
                font-size: 16px;
                border: 2px solid var(--border);
                box-shadow: 2px 2px 0 var(--shadow);
            }
        }
    `;
    document.head.appendChild(style);

    // Create the button
    const btn = document.createElement('button');
    btn.className = 'theme-toggle-btn';
    btn.title = 'Toggle Light/Dark Mode';
    
    // Set initial icon
    const currentTheme = document.documentElement.getAttribute('data-theme');
    btn.innerHTML = currentTheme === 'dark' ? '☀️' : '🌙';

    btn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('neo-theme', newTheme);
        
        // Update icon based on NEW theme
        btn.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
    });

    document.body.appendChild(btn);
});
