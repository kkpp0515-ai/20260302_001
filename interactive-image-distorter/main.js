document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const imageInput = document.getElementById('imageInput');
    const mainCanvas = document.getElementById('mainCanvas');
    const bgImage = document.getElementById('bgImage');
    const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
    const canvasContainer = document.querySelector('.canvas-container');
    const canvasPlaceholder = document.getElementById('canvasPlaceholder');

    // Controls
    const modeMaskBtn = document.getElementById('modeMask');
    const modeInteractBtn = document.getElementById('modeInteract');
    const brushControls = document.getElementById('brushControls');
    const distortionControls = document.getElementById('distortionControls');

    // Sliders
    const brushSizeInput = document.getElementById('brushSize');
    const brushSizeVal = document.getElementById('brushSizeVal');
    const distortRadiusInput = document.getElementById('distortRadius');
    const distortRadiusVal = document.getElementById('distortRadiusVal');
    const distortStrengthInput = document.getElementById('distortStrength');
    const distortStrengthVal = document.getElementById('distortStrengthVal');
    const springTensionInput = document.getElementById('springTension');
    const springTensionVal = document.getElementById('springTensionVal');

    const clearMaskBtn = document.getElementById('clearMaskBtn');

    // --- State ---
    let imgSource = new Image();
    let originalImageData = null;
    let currentImageData = null;
    
    // Mask layer: 0 (unmasked) to 255 (fully masked/movable)
    let maskData = null; 

    // Grid Mesh for distortion
    let meshWidth = 0;
    let meshHeight = 0;
    const GRID_SIZE = 15; // px per grid cell
    let gridPoints = [];    // current positions {x, y}
    let gridOriginal = [];  // rest positions {x, y}
    let gridVelocity = [];  // physics velocity {vx, vy}

    let isDrawing = false;
    let isInteracting = false;
    let currentMode = 'mask'; // 'mask' or 'interact'
    let lastMousePos = { x: 0, y: 0 };
    
    let physicsRafId = null;

    // --- Event Listeners: UI ---

    modeMaskBtn.addEventListener('click', () => setMode('mask'));
    modeInteractBtn.addEventListener('click', () => setMode('interact'));

    brushSizeInput.addEventListener('input', (e) => brushSizeVal.textContent = e.target.value);
    distortRadiusInput.addEventListener('input', (e) => distortRadiusVal.textContent = e.target.value);
    distortStrengthInput.addEventListener('input', (e) => distortStrengthVal.textContent = e.target.value);
    springTensionInput.addEventListener('input', (e) => springTensionVal.textContent = e.target.value);

    // --- Image Upload & Canvas Setup ---

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            imgSource.onload = () => {
                setupCanvas();
            };
            imgSource.src = event.target.result;
            // Also set the background HTML Image for reliable display in all browsers
            bgImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    function setupCanvas() {
        // Calculate size to fit container while maintaining aspect ratio
        const maxWidth = canvasContainer.clientWidth - 40;
        const maxHeight = canvasContainer.clientHeight - 40;
        
        let width = imgSource.width;
        let height = imgSource.height;

        if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
        }
        if (height > maxHeight) {
            width = (maxHeight / height) * width;
            height = maxHeight;
        }

        const rw = Math.floor(width);
        const rh = Math.floor(height);

        mainCanvas.width = rw;
        mainCanvas.height = rh;

        // Ensure BG image matches canvas dimensions exactly
        bgImage.style.width = rw + 'px';
        bgImage.style.height = rh + 'px';
        
        // Show canvas and hide placeholder now that dimensions are set
        canvasPlaceholder.style.display = 'none';
        bgImage.style.display = 'block';
        mainCanvas.style.display = 'block';

        // Draw initial image to get pixel data
        ctx.clearRect(0, 0, rw, rh);
        ctx.drawImage(imgSource, 0, 0, rw, rh);

        try {
            originalImageData = ctx.getImageData(0, 0, rw, rh);
            currentImageData = new ImageData(
                new Uint8ClampedArray(originalImageData.data),
                originalImageData.width,
                originalImageData.height
            );
        } catch (e) {
            console.error("Canvas read error:", e);
            alert("画像データの取得に失敗しました。セキュリティ制限の可能性があります。");
            return;
        }
        
        // Update texture canvas for drawMeshTextured
        if (!window.texCanvas) {
            window.texCanvas = document.createElement('canvas');
        }
        window.texCanvas.width = rw;
        window.texCanvas.height = rh;
        const tctx = window.texCanvas.getContext('2d');
        tctx.putImageData(originalImageData, 0, 0);

        // Clear the main Canvas again so it acts as a transparent overlay on top of bgImage
        ctx.clearRect(0, 0, rw, rh);

        // Initialize Mask (1 byte per pixel)
        maskData = new Uint8ClampedArray(rw * rh);
        
        // Initialize Physics Grid
        initGrid();

        drawFrame(); // Initial render
    }

    // --- Masking Logic ---

    clearMaskBtn.addEventListener('click', () => {
        if (!maskData) return;
        maskData.fill(0);
        drawFrame();
    });

    function drawMaskCircle(cx, cy, radius, value) {
        if (!maskData) return;
        const w = mainCanvas.width;
        const h = mainCanvas.height;

        const r2 = radius * radius;
        // Optimization: loop bounding box
        const minX = Math.max(0, Math.floor(cx - radius));
        const maxX = Math.min(w - 1, Math.ceil(cx + radius));
        const minY = Math.max(0, Math.floor(cy - radius));
        const maxY = Math.min(h - 1, Math.ceil(cy + radius));

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const dx = x - cx;
                const dy = y - cy;
                if (dx * dx + dy * dy <= r2) {
                    // Soft edge brush (optional, currently hard edge)
                    maskData[y * w + x] = value;
                }
            }
        }
    }

    // --- Physics & Grid Logic ---
    // Instead of doing expensive per-pixel physics, we deform a grid of control points
    // and then map pixels using bilinear interpolation (or just simple warping).

    function initGrid() {
        meshWidth = Math.ceil(mainCanvas.width / GRID_SIZE) + 1;
        meshHeight = Math.ceil(mainCanvas.height / GRID_SIZE) + 1;

        gridPoints = new Float32Array(meshWidth * meshHeight * 2); // [x0, y0, x1, y1...]
        gridOriginal = new Float32Array(meshWidth * meshHeight * 2);
        gridVelocity = new Float32Array(meshWidth * meshHeight * 2);

        for (let y = 0; y < meshHeight; y++) {
            for (let x = 0; x < meshWidth; x++) {
                const idx = (y * meshWidth + x) * 2;
                const px = x * GRID_SIZE;
                const py = y * GRID_SIZE;
                
                gridPoints[idx] = px;
                gridPoints[idx + 1] = py;
                
                gridOriginal[idx] = px;
                gridOriginal[idx + 1] = py;
                
                gridVelocity[idx] = 0;
                gridVelocity[idx + 1] = 0;
            }
        }
    }

    function updatePhysics() {
        if (!originalImageData) return;

        const tension = parseFloat(springTensionInput.value);
        const dampening = 0.85; // Friction
        
        // Flag to check if any point is still moving significantly
        let isMoving = false;

        for (let i = 0; i < gridPoints.length; i += 2) {
            const rx = gridOriginal[i];
            const ry = gridOriginal[i + 1];

            // Only apply physics to vertices that are within the masked area
            // We sample the mask at the vertex's original position RestX, RestY
            const maskX = Math.max(0, Math.min(mainCanvas.width - 1, Math.floor(rx)));
            const maskY = Math.max(0, Math.min(mainCanvas.height - 1, Math.floor(ry)));
            const maskVal = maskData[maskY * mainCanvas.width + maskX];
            
            if (maskVal > 0) {
                const cx = gridPoints[i];
                const cy = gridPoints[i + 1];

                // Hooke's Law: F = -k * x
                let dx = rx - cx;
                let dy = ry - cy;
                
                // Force towards original position
                let fx = dx * tension * (maskVal / 255.0) * 0.5;
                let fy = dy * tension * (maskVal / 255.0) * 0.5;

                gridVelocity[i] += fx;
                gridVelocity[i + 1] += fy;

                gridVelocity[i] *= dampening;
                gridVelocity[i + 1] *= dampening;

                gridPoints[i] += gridVelocity[i];
                gridPoints[i + 1] += gridVelocity[i + 1];

                if (Math.abs(gridVelocity[i]) > 0.05 || Math.abs(gridVelocity[i + 1]) > 0.05 || Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                    isMoving = true;
                }
            } else {
                // Pin non-masked points to rest position
                gridPoints[i] = rx;
                gridPoints[i + 1] = ry;
                gridVelocity[i] = 0;
                gridVelocity[i + 1] = 0;
            }
        }

        // Apply grid distortion to pixel data
        renderGridToPixels();
        
        if (isMoving || isInteracting) {
            physicsRafId = requestAnimationFrame(updatePhysics);
        } else {
            physicsRafId = null; 
            // Draw one last frame to snap to rest perfectly
            renderGridToPixels(); 
        }
    }

    function renderGridToPixels() {
        // Clear destination array
        currentImageData.data.set(originalImageData.data);
        
        const src = originalImageData.data;
        const dst = currentImageData.data;
        const w = mainCanvas.width;
        const h = mainCanvas.height;

        // A simple inverse-mapping approach: for every pixel in DST, find where it came from in SRC.
        // Doing this per pixel in JS is slow, so we approximate or use forward mapping if needed.
        // For simplicity and performance, since JS canvas pixel manipulation can be slow,
        // we will use the Canvas API's drawImage with clipped triangles (texture mapping).
        drawMeshTextured();
    }

    // WebGL is faster, but Canvas 2D textured triangles technique is easier to implement without external libs.
    function drawMeshTextured() {
        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        
        // We need a separate invisible canvas holding the original image to use as texture source
        if (!window.texCanvas) {
            window.texCanvas = document.createElement('canvas');
            window.texCanvas.width = mainCanvas.width;
            window.texCanvas.height = mainCanvas.height;
            const tctx = window.texCanvas.getContext('2d');
            tctx.putImageData(originalImageData, 0, 0);
        }

        // Fast drawing: If mode is mask, we don't distort, we just draw image + overlay
        if (currentMode === 'mask') {
            ctx.putImageData(originalImageData, 0, 0);
            drawMaskOverlay();
            return;
        }

        // Draw grid quads (split into 2 triangles)
        for (let y = 0; y < meshHeight - 1; y++) {
            for (let x = 0; x < meshWidth - 1; x++) {
                // Top Left, Top Right, Bottom Left, Bottom Right indices
                const tl_i = (y * meshWidth + x) * 2;
                const tr_i = (y * meshWidth + (x + 1)) * 2;
                const bl_i = ((y + 1) * meshWidth + x) * 2;
                const br_i = ((y + 1) * meshWidth + (x + 1)) * 2;

                // Dest points
                const tl = {x: gridPoints[tl_i], y: gridPoints[tl_i+1]};
                const tr = {x: gridPoints[tr_i], y: gridPoints[tr_i+1]};
                const bl = {x: gridPoints[bl_i], y: gridPoints[bl_i+1]};
                const br = {x: gridPoints[br_i], y: gridPoints[br_i+1]};

                // Source points (Originals)
                const u_tl = {x: gridOriginal[tl_i], y: gridOriginal[tl_i+1]};
                const u_tr = {x: gridOriginal[tr_i], y: gridOriginal[tr_i+1]};
                const u_bl = {x: gridOriginal[bl_i], y: gridOriginal[bl_i+1]};
                const u_br = {x: gridOriginal[br_i], y: gridOriginal[br_i+1]};

                // Canvas 2D doesn't have native quad texture mapping.
                // We fake it. If points haven't moved, we use drawImage optimization.
                const moved = Math.abs(tl.x - u_tl.x) > 0.1 || Math.abs(tl.y - u_tl.y) > 0.1 ||
                              Math.abs(tr.x - u_tr.x) > 0.1 || Math.abs(tr.y - u_tr.y) > 0.1 ||
                              Math.abs(bl.x - u_bl.x) > 0.1 || Math.abs(bl.y - u_bl.y) > 0.1 ||
                              Math.abs(br.x - u_br.x) > 0.1 || Math.abs(br.y - u_br.y) > 0.1;

                if (!moved) {
                    ctx.drawImage(window.texCanvas, 
                        u_tl.x, u_tl.y, GRID_SIZE, GRID_SIZE, 
                        tl.x, tl.y, GRID_SIZE, GRID_SIZE);
                } else {
                    // Draw Triangle 1 (TL, TR, BL)
                    drawTriangle(
                        tl.x, tl.y, tr.x, tr.y, bl.x, bl.y,
                        u_tl.x, u_tl.y, u_tr.x, u_tr.y, u_bl.x, u_bl.y
                    );
                    // Draw Triangle 2 (TR, BR, BL)
                    drawTriangle(
                        tr.x, tr.y, br.x, br.y, bl.x, bl.y,
                        u_tr.x, u_tr.y, u_br.x, u_br.y, u_bl.x, u_bl.y
                    );
                }
            }
        }
    }

    // Affine texture mapping for a triangle (slow, but works without WebGL)
    function drawTriangle(x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.clip(); // Clip to dest triangle

        // Calculate affine transformation matrix
        // [ x0 x1 x2 ]   [ a c e ] [ u0 u1 u2 ]
        // [ y0 y1 y2 ] = [ b d f ] [ v0 v1 v2 ]
        // [  1  1  1 ]   [ 0 0 1 ] [  1  1  1 ]
        
        var den = (u0 * (v2 - v1)) - (u1 * v2) + (v1 * u2) + (u1 * v0) - (u2 * v0);
        if (den === 0) { ctx.restore(); return; } // Collinear points

        var a = -((v0 * (x2 - x1)) - (v1 * x2) + (v1 * x0) + (v2 * x1) - (v2 * x0)) / den;
        var b = -((v0 * (y2 - y1)) - (v1 * y2) + (v1 * y0) + (v2 * y1) - (v2 * y0)) / den;
        var c = ((u0 * (x2 - x1)) - (u1 * x2) + (u1 * x0) + (u2 * x1) - (u2 * x0)) / den;
        var d = ((u0 * (y2 - y1)) - (u1 * y2) + (u1 * y0) + (u2 * y1) - (u2 * y0)) / den;
        var e = (u0 * (v2 * x1 - v1 * x2) + u1 * (v0 * x2 - v2 * x0) + u2 * (v1 * x0 - v0 * x1)) / den;
        var f = (u0 * (v2 * y1 - v1 * y2) + u1 * (v0 * y2 - v2 * y0) + u2 * (v1 * y0 - v0 * y1)) / den;
        
        ctx.transform(a, b, c, d, e, f);
        // Draw the whole source canvas, but it's clipped to the triangle
        ctx.drawImage(window.texCanvas, 0, 0);
        ctx.restore();
    }


    function drawMaskOverlay() {
        if (!maskData) return;
        
        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

        // We draw the mask array as an overlay
        const overData = ctx.createImageData(mainCanvas.width, mainCanvas.height);
        for (let i = 0; i < maskData.length; i++) {
            if (maskData[i] > 0) {
                // Red tint: R, G, B, A
                overData.data[i*4] = 239;     // R (var--danger)
                overData.data[i*4+1] = 68;    // G
                overData.data[i*4+2] = 68;    // B
                overData.data[i*4+3] = 100;   // Alpha (semi-transparent)
            }
        }
        ctx.putImageData(overData, 0, 0); // Put mask overlay
    }

    function drawFrame() {
        if (!originalImageData) return;
        
        if (currentMode === 'mask') {
            // Since we have an HTML image underneath, we just draw the mask overlay
            drawMaskOverlay();
        } else {
            // physics handles rendering in play mode
            if (!physicsRafId) {
                renderGridToPixels();
            }
        }
    }

    // --- Mouse Interaction ---

    function getMousePos(evt) {
        const rect = mainCanvas.getBoundingClientRect();
        // Scale mouse coordinates to match canvas internal resolution
        const scaleX = mainCanvas.width / rect.width;
        const scaleY = mainCanvas.height / rect.height;
        return {
            x: (evt.clientX - rect.left) * scaleX,
            y: (evt.clientY - rect.top) * scaleY
        };
    }

    function handlePointerDown(e) {
        if (!originalImageData) return;
        isDrawing = true;
        const pos = getMousePos(e);
        lastMousePos = pos;
        
        if (currentMode === 'mask') {
            const rad = parseInt(brushSizeInput.value);
            drawMaskCircle(pos.x, pos.y, rad, 255);
            drawFrame();
        } else if (currentMode === 'interact') {
            isInteracting = true;
            if (!physicsRafId) updatePhysics();
            applyDistortionForce(pos.x, pos.y, 0, 0); // initial click
        }
    }

    function handlePointerMove(e) {
        if (!isDrawing || !originalImageData) return;
        const pos = getMousePos(e);
        
        if (currentMode === 'mask') {
            const rad = parseInt(brushSizeInput.value);
            // Draw line between last and current pos for smooth stroke
            const dist = Math.hypot(pos.x - lastMousePos.x, pos.y - lastMousePos.y);
            const steps = Math.max(1, Math.ceil(dist / (rad / 2)));
            for(let i=0; i<=steps; i++){
                const t = i / steps;
                const px = lastMousePos.x + (pos.x - lastMousePos.x) * t;
                const py = lastMousePos.y + (pos.y - lastMousePos.y) * t;
                drawMaskCircle(px, py, rad, 255);
            }
            drawFrame();
        } else if (currentMode === 'interact') {
            // apply dragging force
            const dx = pos.x - lastMousePos.x;
            const dy = pos.y - lastMousePos.y;
            applyDistortionForce(pos.x, pos.y, dx, dy);
        }
        
        lastMousePos = pos;
    }

    function handlePointerUp() {
        isDrawing = false;
        if (currentMode === 'interact') {
            isInteracting = false;
        }
    }

    function applyDistortionForce(mx, my, dx, dy) {
        const radius = parseInt(distortRadiusInput.value);
        const strength = parseInt(distortStrengthInput.value) * 0.5; // multiplier
        const r2 = radius * radius;

        for (let i = 0; i < gridPoints.length; i += 2) {
            const gx = gridPoints[i];
            const gy = gridPoints[i+1];
            
            const distSq = (gx - mx)*(gx - mx) + (gy - my)*(gy - my);
            if (distSq < r2) {
                // Point is within radius, apply force proportional to mouse movement and distance
                const falloff = 1.0 - (distSq / r2); // 1.0 at center, 0.0 at edge
                
                // Add velocity scaled by strength and falloff
                gridVelocity[i] += dx * strength * falloff;
                gridVelocity[i+1] += dy * strength * falloff;
            }
        }
    }

    mainCanvas.addEventListener('mousedown', handlePointerDown);
    mainCanvas.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    mainCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); handlePointerDown(e.touches[0]); });
    mainCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); handlePointerMove(e.touches[0]); });
    window.addEventListener('touchend', handlePointerUp);

    // --- Mode Switching ---

    function setMode(mode) {
        currentMode = mode;
        if (mode === 'mask') {
            modeMaskBtn.classList.add('active');
            modeInteractBtn.classList.remove('active');
            brushControls.style.display = 'block';
            distortionControls.style.display = 'none';
        } else {
            modeMaskBtn.classList.remove('active');
            modeInteractBtn.classList.add('active');
            brushControls.style.display = 'none';
            distortionControls.style.display = 'block';
        }
        drawFrame(); // Update display to show/hide mask overlay
    }

    // --- Recording Logic ---

    const recordBtn = document.getElementById('recordBtn');
    const recordingStatus = document.getElementById('recordingStatus');
    const downloadContainer = document.getElementById('downloadContainer');
    const downloadLink = document.getElementById('downloadLink');

    let mediaRecorder;
    let recordedChunks = [];
    let isRecording = false;

    recordBtn.addEventListener('click', () => {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    });

    function startRecording() {
        if (!originalImageData) {
            alert("先に画像を読み込んでください。");
            return;
        }

        recordedChunks = [];
        
        // 60fps
        const stream = mainCanvas.captureStream(60); 
        
        try {
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        } catch (e) {
            console.error("MediaRecorder setup failed:", e);
            alert("お使いのブラウザでは動画の録画がサポートされていません。");
            return;
        }

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            
            downloadLink.href = url;
            downloadLink.download = 'xx-cake-export-' + Date.now() + '.webm';
            downloadContainer.style.display = 'block';
            
            // Auto play back (optional, we'll just show download for now)
        };

        mediaRecorder.start();
        isRecording = true;
        
        recordBtn.textContent = '録画停止';
        recordBtn.classList.add('recording');
        recordingStatus.textContent = '録画中...';
        downloadContainer.style.display = 'none';

        // Draw continuously while recording to ensure frames are captured
        recordLoop();
    }

    function recordLoop() {
        if (!isRecording) return;
        
        // If physics is not running, we still need to draw frames for the recorder
        if (!physicsRafId) {
            drawFrame();
        }
        
        requestAnimationFrame(recordLoop);
    }

    function stopRecording() {
        if (!mediaRecorder) return;
        
        mediaRecorder.stop();
        isRecording = false;
        
        recordBtn.textContent = '録画開始 (WebM)';
        recordBtn.classList.remove('recording');
        recordingStatus.textContent = '完了';
    }

});
