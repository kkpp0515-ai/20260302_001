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

let currentImage = null;

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
    // Note: We use a robust fallback font family
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
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            renderCanvas();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

const inputs = [textInput, colorInput, sizeInput, strokeColorInput, strokeWidthInput, paddingInput];
inputs.forEach(input => {
    input.addEventListener('input', renderCanvas);
});

downloadBtn.addEventListener('click', () => {
    if (!currentImage) {
        alert('画像を選択してください (Please upload an image first).');
        return;
    }
    
    // Get original filename without extension
    const originalFile = imageInput.files[0];
    const originalName = originalFile.name.substring(0, originalFile.name.lastIndexOf('.')) || 'image';

    const link = document.createElement('a');
    link.download = `${originalName}_watermarked.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
});
