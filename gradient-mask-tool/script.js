let img = null;

const state = {
    direction: 'down',
    fadeStart: 0.25,
    fadeEnd: 0.65,
    color: '#000000',
    opacity: 1.0
};

// [from_x, from_y, to_x, to_y] as fractions of image size
// from = transparent end, to = opaque end
const DIRS = {
    up:    [0.5, 1.0, 0.5, 0.0],
    down:  [0.5, 0.0, 0.5, 1.0],
    left:  [1.0, 0.5, 0.0, 0.5],
    right: [0.0, 0.5, 1.0, 0.5],
    ul:    [1.0, 1.0, 0.0, 0.0],
    ur:    [0.0, 1.0, 1.0, 0.0],
    dl:    [1.0, 0.0, 0.0, 1.0],
    dr:    [0.0, 0.0, 1.0, 1.0]
};

function hexToRgb(hex) {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16)
    };
}

function render() {
    if (!img) return;

    const canvas = document.getElementById('previewCanvas');
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Draw original image
    ctx.drawImage(img, 0, 0);

    // Build gradient
    const [fx, fy, tx, ty] = DIRS[state.direction];
    const grad = ctx.createLinearGradient(fx * W, fy * H, tx * W, ty * H);

    const { r, g, b } = hexToRgb(state.color);
    const maxA = state.opacity;
    const fs = state.fadeStart;
    const fe = Math.max(fs + 0.01, state.fadeEnd);

    // Transparent end → fade → fully opaque end
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    if (fs > 0.005) grad.addColorStop(fs, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(Math.min(fe, 1.0), `rgba(${r},${g},${b},${maxA})`);
    if (fe < 0.995) grad.addColorStop(1.0, `rgba(${r},${g},${b},${maxA})`);

    // source-atop: gradient only affects pixels where original has alpha
    // output alpha stays = original alpha (transparent areas remain transparent)
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
}

function loadImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
        const image = new Image();
        image.onload = () => {
            img = image;
            document.getElementById('placeholder').style.display = 'none';
            const canvas = document.getElementById('previewCanvas');
            canvas.style.display = 'block';
            document.getElementById('downloadBtn').disabled = false;
            document.getElementById('fileName').textContent = file.name;
            render();
        };
        image.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// File input
const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', e => loadImage(e.target.files[0]));

// Drop zone
const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    loadImage(e.dataTransfer.files[0]);
});

// Direction buttons
document.getElementById('dirGrid').addEventListener('click', e => {
    const btn = e.target.closest('[data-dir]:not([disabled])');
    if (!btn || !btn.dataset.dir) return;
    document.querySelectorAll('#dirGrid .dir-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.direction = btn.dataset.dir;
    render();
});

// Fade start slider
document.getElementById('fadeStart').addEventListener('input', e => {
    const v = parseInt(e.target.value);
    state.fadeStart = v / 100;
    document.getElementById('fadeStartVal').textContent = v + '%';
    const feEl = document.getElementById('fadeEnd');
    if (v >= parseInt(feEl.value)) {
        const nv = Math.min(v + 10, 100);
        feEl.value = nv;
        state.fadeEnd = nv / 100;
        document.getElementById('fadeEndVal').textContent = nv + '%';
    }
    render();
});

// Fade end slider
document.getElementById('fadeEnd').addEventListener('input', e => {
    const v = parseInt(e.target.value);
    state.fadeEnd = v / 100;
    document.getElementById('fadeEndVal').textContent = v + '%';
    const fsEl = document.getElementById('fadeStart');
    if (v <= parseInt(fsEl.value)) {
        const nv = Math.max(v - 10, 0);
        fsEl.value = nv;
        state.fadeStart = nv / 100;
        document.getElementById('fadeStartVal').textContent = nv + '%';
    }
    render();
});

// Color
document.getElementById('colorInput').addEventListener('input', e => {
    state.color = e.target.value;
    render();
});

// Opacity
document.getElementById('opacityInput').addEventListener('input', e => {
    const v = parseInt(e.target.value);
    state.opacity = v / 100;
    document.getElementById('opacityVal').textContent = v + '%';
    render();
});

// Download
document.getElementById('downloadBtn').addEventListener('click', () => {
    if (!img) return;
    const canvas = document.getElementById('previewCanvas');
    const a = document.createElement('a');
    a.download = 'gradient-mask.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
});
