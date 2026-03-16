// UI Elements
const newRatingName = document.getElementById('newRatingName');
const newRatingImage = document.getElementById('newRatingImage');
const addRatingBtn = document.getElementById('addRatingBtn');
const ratingPreviewContainer = document.getElementById('ratingPreviewContainer');
const newRatingPreview = document.getElementById('newRatingPreview');
const savedRatingsList = document.getElementById('savedRatingsList');
const ratingSelect = document.getElementById('ratingSelect');

const dropZone = document.getElementById('dropZone');
const bannerInput = document.getElementById('bannerInput');
const positionSelect = document.getElementById('positionSelect');
const suffixInput = document.getElementById('suffixInput');
const processBtn = document.getElementById('processBtn');
const statusMessage = document.getElementById('statusMessage');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');

let pendingRatingBase64 = null;
let uploadedBanners = [];

// Load ratings from LocalStorage
function loadRatings() {
    const ratings = JSON.parse(localStorage.getItem('savedRatings') || '[]');
    renderRatingsList(ratings);
    updateRatingSelect(ratings);
}

function saveRatings(ratings) {
    localStorage.setItem('savedRatings', JSON.stringify(ratings));
    loadRatings();
}

// 1. Managing Ratings (Initialization)
newRatingImage.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            pendingRatingBase64 = event.target.result;
            newRatingPreview.src = pendingRatingBase64;
            ratingPreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

addRatingBtn.addEventListener('click', () => {
    const name = newRatingName.value.trim();
    if (!name || !pendingRatingBase64) {
        alert('名前を入力し、画像を選択してください。');
        return;
    }

    const ratings = JSON.parse(localStorage.getItem('savedRatings') || '[]');
    const newId = 'rating_' + Date.now();
    ratings.push({
        id: newId,
        name: name,
        image: pendingRatingBase64
    });

    saveRatings(ratings);
    newRatingName.value = '';
    newRatingImage.value = '';
    pendingRatingBase64 = null;
    ratingPreviewContainer.classList.add('hidden');
    newRatingPreview.src = '';
});

function deleteRating(id) {
    let ratings = JSON.parse(localStorage.getItem('savedRatings') || '[]');
    ratings = ratings.filter(r => r.id !== id);
    saveRatings(ratings);
}

function renderRatingsList(ratings) {
    savedRatingsList.innerHTML = '';
    if (ratings.length === 0) {
        savedRatingsList.innerHTML = '<p class="help-text">保存されたレーティングはありません。</p>';
        return;
    }

    ratings.forEach(rating => {
        const div = document.createElement('div');
        div.className = 'rating-item';
        div.innerHTML = `
            <div class="rating-item-info">
                <img src="${rating.image}" alt="${rating.name}">
                <span>${rating.name}</span>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteRating('${rating.id}')">削除</button>
        `;
        savedRatingsList.appendChild(div);
    });
}

function updateRatingSelect(ratings) {
    ratingSelect.innerHTML = '';
    if (ratings.length === 0) {
        ratingSelect.innerHTML = '<option value="">設定から追加してください</option>';
        return;
    }

    ratings.forEach(rating => {
        const option = document.createElement('option');
        option.value = rating.id;
        option.textContent = rating.name;
        ratingSelect.appendChild(option);
    });
    
    validateProcessState();
}

// 2. Banner Processing
function handleBanners(files) {
    uploadedBanners = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (uploadedBanners.length > 0) {
        dropZone.querySelector('strong').textContent = `${uploadedBanners.length} 個の画像を選択中`;
    } else {
        dropZone.querySelector('strong').textContent = `画像をドラッグ＆ドロップ`;
    }
    
    validateProcessState();
}

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files) {
        handleBanners(e.dataTransfer.files);
    }
});

bannerInput.addEventListener('change', (e) => {
    if (e.target.files) {
        handleBanners(e.target.files);
    }
});

function validateProcessState() {
    const ratingId = ratingSelect.value;
    if (ratingId && uploadedBanners.length > 0) {
        processBtn.disabled = false;
    } else {
        processBtn.disabled = true;
    }
}

ratingSelect.addEventListener('change', validateProcessState);

// File Name Generation Logic
function generateNewFileName(oldName, suffix) {
    if (!suffix) suffix = "linerate"; // fallback
    
    // 1080-1080などのサイズ名の前の_にlinerateというファイル名を付与する
    // e.g., kakegurui_zh-TW_rf041_1080-1080.jpg -> kakegurui_zh-TW_rf041_linerate_1080-1080.jpg
    // This regex looks for an underscore followed by the size pattern and extension
    const sizeRegex = /_(\d+x\d+|\d+-\d+)(\.[a-zA-Z0-9]+)$/i;
    
    if (sizeRegex.test(oldName)) {
        return oldName.replace(sizeRegex, `_${suffix}_$1$2`);
    }

    // Fallback: Just insert suffix before extension if no size pattern found
    const lastDot = oldName.lastIndexOf('.');
    if (lastDot !== -1) {
        return oldName.substring(0, lastDot) + `_${suffix}` + oldName.substring(lastDot);
    }
    
    return oldName + `_${suffix}`;
}


// Processing Logic
processBtn.addEventListener('click', async () => {
    const selectedRatingId = ratingSelect.value;
    const position = positionSelect.value;
    const suffix = suffixInput.value.trim() || 'linerate';
    
    if (!selectedRatingId || uploadedBanners.length === 0) return;
    
    processBtn.disabled = true;
    statusMessage.textContent = '処理中...';
    statusMessage.className = 'status-message';
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    
    const ratings = JSON.parse(localStorage.getItem('savedRatings') || '[]');
    const ratingObj = ratings.find(r => r.id === selectedRatingId);
    
    let processedFiles = [];
    
    try {
        const ratingImg = await loadImage(ratingObj.image);
        
        for (let i = 0; i < uploadedBanners.length; i++) {
            const bannerFile = uploadedBanners[i];
            const bannerImg = await loadFileAsImage(bannerFile);
            
            // Create canvas for rendering
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = bannerImg.width;
            canvas.height = bannerImg.height;
            
            // Draw original banner
            ctx.drawImage(bannerImg, 0, 0);
            
            // Calculate rating dimensions: 5% of longer edge
            const longerEdge = Math.max(bannerImg.width, bannerImg.height);
            const targetSize = longerEdge * 0.05;
            
            const aspect = ratingImg.width / ratingImg.height;
            let finalWidth = targetSize;
            let finalHeight = targetSize;
            
            // Maintain aspect ratio of the rating mark
            if (aspect > 1) {
                finalHeight = targetSize / aspect;
            } else {
                finalWidth = targetSize * aspect;
            }
            
            // 3px padding
            const padding = 3;
            let x = 0;
            let y = 0;
            
            switch (position) {
                case 'top-left':
                    x = padding;
                    y = padding;
                    break;
                case 'top-right':
                    x = canvas.width - finalWidth - padding;
                    y = padding;
                    break;
                case 'bottom-left':
                    x = padding;
                    y = canvas.height - finalHeight - padding;
                    break;
                case 'bottom-right':
                    x = canvas.width - finalWidth - padding;
                    y = canvas.height - finalHeight - padding;
                    break;
            }
            
            // Draw rating
            ctx.drawImage(ratingImg, x, y, finalWidth, finalHeight);
            
            // Export image as blob
            const newFileName = generateNewFileName(bannerFile.name, suffix);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, bannerFile.type || 'image/jpeg', 0.95));
            
            processedFiles.push({
                name: newFileName,
                blob: blob
            });
            
            progressBar.style.width = `${((i + 1) / uploadedBanners.length) * 100}%`;
        }
        
        // Finalize Zip or single file
        if (processedFiles.length === 1) {
            saveAs(processedFiles[0].blob, processedFiles[0].name);
        } else {
            const zip = new JSZip();
            processedFiles.forEach(file => {
                zip.file(file.name, file.blob);
            });
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `banners_rated_${Date.now()}.zip`);
        }
        
        statusMessage.textContent = '処理が完了しました！';
        statusMessage.className = 'status-message success';
        
    } catch (e) {
        console.error(e);
        statusMessage.textContent = 'エラーが発生しました。詳細はコンソールをご確認ください。';
        statusMessage.className = 'status-message error';
    } finally {
        processBtn.disabled = false;
        setTimeout(() => {
            progressContainer.classList.add('hidden');
        }, 3000);
    }
});

// Helper utilities for Image Loading
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function loadFileAsImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            loadImage(e.target.result).then(resolve).catch(reject);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Initial Load
loadRatings();
