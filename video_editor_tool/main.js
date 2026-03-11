/**
 * Template-based Video Character Replacer
 * Focuses on AE Template JSON import and manual character adjustment.
 */

class VideoCompositor {
    constructor() {
        this.canvas = document.getElementById('main-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('canvas-container');

        // Layers (Simplified to just Background and Character)
        this.layers = {
            background: { element: null, type: null, x: 0, y: 0, scale: 1, opacity: 1, chromaKey: false, chromaColor: '#00ff00', tolerance: 0.1 },
            character: { element: null, type: null, x: 0, y: 0, scale: 1, opacity: 1, chromaKey: false, chromaColor: '#00ff00', tolerance: 0.1 }
        };

        // Off-screen canvas for pixel manipulation (Chroma Key)
        this.offCanvas = document.createElement('canvas');
        this.offCtx = this.offCanvas.getContext('2d', { willReadFrequently: true });

        this.isPlaying = false;
        this.isExporting = false;
        this.duration = 0;
        this.resolution = { width: 1920, height: 1080 };
        this.selectedLayer = 'character';

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.resizeCanvas();
        this.startRenderLoop();
    }

    setupEventListeners() {
        // File Uploads
        document.getElementById('bg-upload').addEventListener('change', (e) => this.handleUpload(e, 'background'));
        document.getElementById('char-upload').addEventListener('change', (e) => this.handleUpload(e, 'character'));
        document.getElementById('template-upload').addEventListener('change', (e) => this.handleTemplateUpload(e));

        // Layer Selection (Background or Character)
        const layerControls = [
            document.querySelector('.control-group[data-layer="background"]'),
            document.querySelector('.control-group[data-layer="character"]')
        ];

        layerControls.forEach(group => {
            if (!group) return;
            group.addEventListener('click', () => {
                layerControls.forEach(g => g?.classList.remove('active'));
                group.classList.add('active');
                this.selectedLayer = group.dataset.layer;
                this.syncControls();
            });
        });

        // Controls
        ['posX', 'posY', 'scale'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                const layer = this.layers[this.selectedLayer];
                const key = id.replace('pos', '').toLowerCase();
                layer[key] = parseFloat(e.target.value);
            });
        });

        // Chroma Key
        document.getElementById('chroma-toggle').addEventListener('change', (e) => {
            this.layers[this.selectedLayer].chromaKey = e.target.checked;
        });
        document.getElementById('chroma-color').addEventListener('input', (e) => {
            this.layers[this.selectedLayer].chromaColor = e.target.value;
        });
        document.getElementById('chroma-tolerance').addEventListener('input', (e) => {
            this.layers[this.selectedLayer].tolerance = parseFloat(e.target.value);
        });

        // Resolution
        document.getElementById('resolution').addEventListener('change', (e) => {
            const [w, h] = e.target.value.split('x').map(Number);
            this.resolution = { width: w, height: h };
            this.resizeCanvas();
            // Automatically center all layers on resolution change
            Object.keys(this.layers).forEach(k => {
                this.layers[k].x = 0;
                this.layers[k].y = 0;
            });
            this.syncControls();
        });

        // Center Action
        document.getElementById('center-btn').addEventListener('click', () => {
            const layer = this.layers[this.selectedLayer];
            layer.x = 0;
            layer.y = 0;
            this.syncControls();
        });

        document.getElementById('play-pause-btn').addEventListener('click', () => this.togglePlayback());
        document.getElementById('export-btn').addEventListener('click', () => this.exportVideo());

        // Drag & Drop Positioning
        let isDragging = false;
        let lastX, lastY;
        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.layers[this.selectedLayer].element) return;
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const layer = this.layers[this.selectedLayer];
            layer.x += dx * scaleX;
            layer.y += dy * scaleY;

            this.syncControls();

            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener('mouseup', () => isDragging = false);
    }

    syncControls() {
        const layer = this.layers[this.selectedLayer];
        document.getElementById('posX').value = layer.x;
        document.getElementById('posY').value = layer.y;
        document.getElementById('scale').value = layer.scale;
        document.getElementById('chroma-toggle').checked = layer.chromaKey;
        document.getElementById('chroma-color').value = layer.chromaColor;
        document.getElementById('chroma-tolerance').value = layer.tolerance;

        const layerTitle = { 'background': '背景 / 動画', 'character': '素材 / 帯' };
        document.querySelector('.control-title-active').textContent = `編集中のレイヤー: ${layerTitle[this.selectedLayer]}`;
    }

    handleUpload(event, layerKey) {
        const file = event.target.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const isVideo = file.type.startsWith('video') || file.name.toLowerCase().endsWith('.mov');
        const type = isVideo ? 'video' : 'image';

        const setupElement = (el) => {
            this.layers[layerKey].element = el;
            this.layers[layerKey].type = type;
            this.layers[layerKey].x = 0;
            this.layers[layerKey].y = 0;
            this.layers[layerKey].scale = 1;

            if (layerKey === 'background') {
                this.duration = Math.max(this.duration, el.duration || 0);
            }

            if (type === 'video') {
                setTimeout(() => {
                    try {
                        const posterCanvas = document.createElement('canvas');
                        posterCanvas.width = el.videoWidth || 1920;
                        posterCanvas.height = el.videoHeight || 1080;
                        const pCtx = posterCanvas.getContext('2d');
                        pCtx.drawImage(el, 0, 0);
                        this.layers[layerKey].posterFrame = posterCanvas;
                    } catch (e) { console.warn("Could not capture poster frame"); }
                }, 500);
            }

            this.selectedLayer = layerKey;

            document.querySelectorAll('.control-group[data-layer]').forEach(g => {
                g.classList.remove('active');
                if (g.dataset.layer === layerKey) g.classList.add('active');
            });
            this.syncControls();
        };

        if (type === 'video') {
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;

            video.onerror = () => {
                console.error("Video load error: Browser likely doesn't support the codec (e.g., ProRes .mov)");
                // Create a placeholder visual
                const placeholder = { width: 1280, height: 720, isPlaceholder: true, name: file.name };
                this.layers[layerKey].element = placeholder;
                this.layers[layerKey].type = 'placeholder';
                this.layers[layerKey].x = 0;
                this.layers[layerKey].y = 0;
                this.layers[layerKey].scale = 1;
                this.selectedLayer = layerKey;
                document.querySelectorAll('.control-group[data-layer]').forEach(g => {
                    g.classList.remove('active');
                    if (g.dataset.layer === layerKey) g.classList.add('active');
                });
                this.syncControls();
                alert(`通知: この動画ファイル (${file.name}) はブラウザで直接再生できない形式です。\n\n「位置合わせ用の箱」として読み込みました。このまま位置調整は可能ですが、書き出し時に反映させるには「WebM形式」での書き出しを推奨します。`);
            };

            video.onloadedmetadata = () => {
                video.currentTime = 0;
                setupElement(video);
            };

            video.src = url;
            video.load();
        } else {
            const img = new Image();
            img.src = url;
            img.onload = () => setupElement(img);
        }
    }

    handleTemplateUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.applyTemplate(data);
                alert(`テンプレート "${data.comp.name}" を読み込みました。`);
            } catch (err) {
                alert("テンプレートファイルの読み込みに失敗しました。");
            }
        };
        reader.readAsText(file);
    }

    applyTemplate(data) {
        if (!data || !data.comp || !data.layers) return;

        this.resolution = { width: data.comp.width, height: data.comp.height };
        this.resizeCanvas();

        // Apply Layer Transforms
        data.layers.forEach(templateLayer => {
            const name = templateLayer.name.toLowerCase();
            let targetKey = null;

            if (name.includes('character')) targetKey = 'character';
            else if (name.includes('bg') || name.includes('background')) targetKey = 'background';

            if (targetKey) {
                const layer = this.layers[targetKey];

                // AE Coordinates to Canvas Coordinates
                // AE center is (width/2, height/2). 
                // Our internal layer.x/y is relative to canvas center.
                // AE pos is absolute from top-left.
                const aePosX = templateLayer.position[0];
                const aePosY = templateLayer.position[1];

                layer.x = aePosX - (data.comp.width / 2);
                layer.y = aePosY - (data.comp.height / 2);

                // AE Scale is percentage (100 = 1.0)
                layer.scale = templateLayer.scale[0] / 100;
                layer.opacity = templateLayer.opacity / 100;
            }
        });

        this.syncControls();
    }

    resizeCanvas() {
        this.canvas.width = this.resolution.width;
        this.canvas.height = this.resolution.height;
    }

    togglePlayback() {
        this.isPlaying = !this.isPlaying;
        document.getElementById('play-pause-btn').textContent = this.isPlaying ? '⏸' : '▶';

        const playMethod = this.isPlaying ? 'play' : 'pause';

        // Only play the background in preview mode to keep it light
        if (this.layers.background.element && this.layers.background.type === 'video') {
            this.layers.background.element[playMethod]().catch(() => { });
        }
    }

    startRenderLoop() {
        const render = () => {
            this.draw();
            requestAnimationFrame(render);
        };
        render();
    }

    draw() {
        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);

        this.drawLayer('background');
        this.drawLayer('character');

        this.updateTimeline();
    }

    drawLayer(key) {
        const layer = this.layers[key];
        if (!layer.element) return;

        const { width, height } = this.canvas;
        let el = layer.element;

        // Handle placeholders (unsupported videos)
        if (layer.type === 'placeholder') {
            const pw = el.width * layer.scale;
            const ph = el.height * layer.scale;
            const px = (width / 2) + layer.x - (pw / 2);
            const py = (height / 2) + layer.y - (ph / 2);

            this.ctx.save();
            this.ctx.globalAlpha = layer.opacity * 0.5;
            this.ctx.fillStyle = '#3b82f6';
            this.ctx.fillRect(px, py, pw, ph);
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(px, py, pw, ph);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px Inter';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`Unsupported: ${el.name}`, px + pw / 2, py + ph / 2);
            this.ctx.fillText("書き出し前にWebMへ変換してください", px + pw / 2, py + ph / 2 + 40);
            this.ctx.restore();
            return;
        }

        // If it's a video layer and we are NOT exporting, use the poster frame
        if (layer.type === 'video' && !this.isExporting && key !== 'background' && layer.posterFrame) {
            el = layer.posterFrame;
        }

        const elW = el.videoWidth || el.width;
        const elH = el.videoHeight || el.height;
        const sw = elW * layer.scale;
        const sh = elH * layer.scale;

        this.ctx.save();
        this.ctx.globalAlpha = layer.opacity;

        const dx = (width / 2) + layer.x - (sw / 2);
        const dy = (height / 2) + layer.y - (sh / 2);

        if (layer.chromaKey) {
            this.applyChromaKey(el, dx, dy, sw, sh, layer.chromaColor, layer.tolerance);
        } else {
            this.ctx.drawImage(el, dx, dy, sw, sh);
        }
        this.ctx.restore();
    }

    applyChromaKey(el, x, y, w, h, targetHex, tolerance) {
        // Prepare off-screen canvas scale
        this.offCanvas.width = el.videoWidth || el.width;
        this.offCanvas.height = el.videoHeight || el.height;
        this.offCtx.drawImage(el, 0, 0);

        const imageData = this.offCtx.getImageData(0, 0, this.offCanvas.width, this.offCanvas.height);
        const data = imageData.data;

        // Parse target color
        const rT = parseInt(targetHex.slice(1, 3), 16);
        const gT = parseInt(targetHex.slice(3, 5), 16);
        const bT = parseInt(targetHex.slice(5, 7), 16);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // simple color distance
            const diff = Math.sqrt(
                Math.pow(r - rT, 2) +
                Math.pow(g - gT, 2) +
                Math.pow(b - bT, 2)
            ) / 441.67; // normalize by max distance

            if (diff < tolerance) {
                data[i + 3] = 0; // Transparent
            } else if (diff < tolerance + 0.05) {
                // Smooth edge
                data[i + 3] = ((diff - tolerance) / 0.05) * 255;
            }
        }

        this.offCtx.putImageData(imageData, 0, 0);
        this.ctx.drawImage(this.offCanvas, x, y, w, h);
    }

    updateTimeline() {
        if (!this.layers.background.element || this.layers.background.type !== 'video') return;
        const video = this.layers.background.element;
        const progress = (video.currentTime / video.duration) * 100;
        document.getElementById('progress-bar').style.width = `${progress}%`;
        const current = this.formatTime(video.currentTime);
        const total = this.formatTime(video.duration);
        document.getElementById('time-display').textContent = `${current} / ${total}`;
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    async exportVideo() {
        this.isExporting = true;
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.remove('hidden');

        // Prepare audio mixing
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        let hasAudio = false;

        // Reset and play ALL layers for export, and capture audio
        Object.values(this.layers).forEach(layer => {
            if (layer.type === 'video' && layer.element) {
                layer.element.currentTime = 0;
                layer.element.muted = false; // Unmute for recording

                try {
                    const source = audioCtx.createMediaElementSource(layer.element);
                    source.connect(dest);
                    source.connect(audioCtx.destination); // Also play through speakers/preview
                    hasAudio = true;
                } catch (e) {
                    console.warn("Audio capture not possible for a layer, might be cross-origin or already connected", e);
                }

                layer.element.play().catch(() => { });
            }
        });

        const canvasStream = this.canvas.captureStream(30);
        const finalStream = new MediaStream();

        // Add video track
        canvasStream.getVideoTracks().forEach(track => finalStream.addTrack(track));

        // Add audio track if available
        if (hasAudio) {
            dest.stream.getAudioTracks().forEach(track => finalStream.addTrack(track));
        }

        // Try MP4 first, fallback to WebM if not supported
        let options = { mimeType: 'video/mp4; codecs=avc1.42E01E' };
        let extension = 'mp4';

        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.warn("video/mp4 not supported, falling back to video/webm");
            options = { mimeType: 'video/webm; codecs=vp9' };
            extension = 'webm';
        }

        const recorder = new MediaRecorder(finalStream, options);
        const chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: options.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `template_export_${Date.now()}.${extension}`;
            a.click();
            overlay.classList.add('hidden');
            this.isExporting = false;

            // Clean up audio
            audioCtx.close();
            Object.values(this.layers).forEach(layer => {
                if (layer.type === 'video' && layer.element) {
                    layer.element.muted = true; // Re-mute
                }
            });
        };

        recorder.start();
        const duration = (this.layers.background.element?.duration || 5) * 1000;
        let elapsed = 0;
        const interval = setInterval(() => {
            elapsed += 100;
            const prog = Math.min(Math.round((elapsed / duration) * 100), 99);
            document.getElementById('export-progress').textContent = `${prog}%`;
            if (elapsed >= duration) {
                clearInterval(interval);
                recorder.stop();
                Object.values(this.layers).forEach(layer => {
                    if (layer.type === 'video' && layer.element) layer.element.pause();
                });
            }
        }, 100);
    }
}

// Initialize on load
window.addEventListener('load', () => {
    new VideoCompositor();
});
