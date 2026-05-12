const imageInput = document.getElementById('imageInput');
const textInput = document.getElementById('textInput');
const colorInput = document.getElementById('colorInput');
const sizeInput = document.getElementById('sizeInput');
const strokeColorInput = document.getElementById('strokeColorInput');
const strokeWidthInput = document.getElementById('strokeWidthInput');
const paddingInput = document.getElementById('paddingInput');
const downloadBtn = document.getElementById('downloadBtn');
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const fileCountDisplay = document.getElementById('fileCountDisplay');

let currentImage = null; // Used for preview (first image)
let selectedFiles = []; // All selected files

function renderCanvas() {
    if (!currentImage) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    // Set canvas dimensions to match image
    canvas.width = currentImage.width;
    canvas.height = currentImage.height;

    // Draw image
    ctx.drawImage(currentImage, 0, 0);

    // Get settings
    const text = textInput.value;
    const color = colorInput.value;
    const size = parseInt(sizeInput.value, 10) || 80;
    const strokeColor = strokeColorInput.value;
    const strokeWidth = parseInt(strokeWidthInput.value, 10) || 0;
    const padding = parseInt(paddingInput.value, 10) || 0;

    if (!text) return;

    // Set font
    ctx.font = `bold ${size}px "Segoe UI", system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';

    // Calculate position (top right with padding)
    const x = canvas.width - padding;
    const y = padding;

    // Draw border
    if (strokeWidth > 0) {
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
    }

    // Draw text
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

// Event listeners
imageInput.addEventListener('change', (e) => {
    selectedFiles = Array.from(e.target.files);
    
    if (selectedFiles.length === 0) {
        currentImage = null;
        if (fileCountDisplay) fileCountDisplay.textContent = "";
        downloadBtn.textContent = "Download Image";
        renderCanvas();
        return;
    }

    if (fileCountDisplay) {
        fileCountDisplay.textContent = `${selectedFiles.length} 枚の画像を選択中 (最初の1枚をプレビュー中)`;
    }
    
    if (selectedFiles.length > 1) {
        downloadBtn.textContent = `Download All (${selectedFiles.length} files ZIP)`;
    } else {
        downloadBtn.textContent = "Download Image";
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            renderCanvas();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(selectedFiles[0]);
});

const inputs = [textInput, colorInput, sizeInput, strokeColorInput, strokeWidthInput, paddingInput];
inputs.forEach(input => {
    input.addEventListener('input', renderCanvas);
});

// Helper to process one image (used for batch processing)
function processImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                tempCtx.drawImage(img, 0, 0);
                
                const text = textInput.value;
                const color = colorInput.value;
                const size = parseInt(sizeInput.value, 10) || 80;
                const strokeColor = strokeColorInput.value;
                const strokeWidth = parseInt(strokeWidthInput.value, 10) || 0;
                const padding = parseInt(paddingInput.value, 10) || 0;
                
                if (text) {
                    tempCtx.font = `bold ${size}px "Segoe UI", system-ui, -apple-system, sans-serif`;
                    tempCtx.textBaseline = 'top';
                    tempCtx.textAlign = 'right';

                    const x = tempCanvas.width - padding;
                    const y = padding;

                    if (strokeWidth > 0) {
                        tempCtx.lineWidth = strokeWidth;
                        tempCtx.strokeStyle = strokeColor;
                        tempCtx.lineJoin = 'round';
                        tempCtx.strokeText(text, x, y);
                    }

                    tempCtx.fillStyle = color;
                    tempCtx.fillText(text, x, y);
                }
                
                const dataUrl = tempCanvas.toDataURL('image/png');
                const base64Data = dataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
                
                let originalName = file.name;
                const lastDotIdx = originalName.lastIndexOf('.');
                const nameWithoutExt = lastDotIdx > -1 ? originalName.substring(0, lastDotIdx) : originalName;
                
                resolve({
                    filename: `${nameWithoutExt}_watermarked.png`,
                    data: base64Data
                });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

downloadBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        alert('画像を選択してください (Please upload an image first).');
        return;
    }
    
    downloadBtn.disabled = true;
    const originalText = downloadBtn.textContent;
    downloadBtn.textContent = "Processing...";
    
    try {
        if (selectedFiles.length === 1) {
            // Single file
            const result = await processImage(selectedFiles[0]);
            const link = document.createElement('a');
            link.download = result.filename;
            link.href = `data:image/png;base64,${result.data}`;
            link.click();
        } else {
            // Multiple files (ZIP)
            const zip = new JSZip();
            for (let i = 0; i < selectedFiles.length; i++) {
                downloadBtn.textContent = `Processing ${i + 1}/${selectedFiles.length}...`;
                const result = await processImage(selectedFiles[i]);
                zip.file(result.filename, result.data, {base64: true});
            }
            downloadBtn.textContent = "Zipping...";
            const content = await zip.generateAsync({type:"blob"});
            const link = document.createElement('a');
            link.download = "watermarked_images.zip";
            link.href = URL.createObjectURL(content);
            link.click();
        }
    } catch(err) {
        console.error(err);
        alert('エラーが発生しました (Error processing images).');
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = originalText;
    }
});
