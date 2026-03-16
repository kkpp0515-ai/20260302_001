document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileListContainer = document.getElementById('file-list-container');
    const fileList = document.getElementById('file-list');
    const fileCount = document.getElementById('file-count');
    const convertBtn = document.getElementById('convert-btn');
    const progressArea = document.getElementById('progress-area');
    const progressBar = document.getElementById('progress-bar');
    const progressStatus = document.getElementById('progress-status');

    let selectedFiles = [];

    // Setup drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    });

    // Setup file input
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
    });

    dropZone.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
            fileInput.click();
        }
    });

    function handleFiles(files) {
        const validExtensions = ['.tif', '.tiff'];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            
            if (validExtensions.includes(ext) || file.type === 'image/tiff') {
                // Avoid duplicates based on name and size
                if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
                    selectedFiles.push({
                        file: file,
                        status: 'pending', // pending, converting, done, error
                        dataUrl: null
                    });
                }
            }
        }
        
        updateUI();
    }

    function updateUI() {
        if (selectedFiles.length > 0) {
            fileListContainer.style.display = 'block';
            fileCount.textContent = selectedFiles.length;
            renderFileList();
        } else {
            fileListContainer.style.display = 'none';
        }
    }

    function formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function renderFileList() {
        fileList.innerHTML = '';
        selectedFiles.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            
            let statusText = '待機中';
            let statusClass = '';
            if (item.status === 'converting') {
                statusText = '変換中...';
            } else if (item.status === 'done') {
                statusText = '完了';
                statusClass = 'success';
            } else if (item.status === 'error') {
                statusText = 'エラー';
            }

            li.innerHTML = `
                <div class="file-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                </div>
                <div class="file-info">
                    <div class="file-name">${item.file.name}</div>
                    <div class="file-size">${formatSize(item.file.size)}</div>
                </div>
                <div class="file-status ${statusClass}">${statusText}</div>
            `;
            fileList.appendChild(li);
        });
    }

    function readFileSync(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    async function processTiff(buffer) {
        try {
            const ifds = UTIF.decode(buffer);
            if (!ifds || ifds.length === 0) throw new Error("不正なTIFFファイルです");
            
            // Just decode the first page
            const firstPage = ifds[0];
            UTIF.decodeImage(buffer, firstPage);
            
            const rgba = UTIF.toRGBA8(firstPage); // Uint8Array
            const width = firstPage.width;
            const height = firstPage.height;
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            const imgData = new ImageData(new Uint8ClampedArray(rgba.buffer), width, height);
            ctx.putImageData(imgData, 0, 0);
            
            // Format to jpeg
            return canvas.toDataURL('image/jpeg', 0.95);
        } catch (error) {
            console.error("TIFF parsing err:", error);
            throw error;
        }
    }

    convertBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;
        
        convertBtn.disabled = true;
        progressArea.style.display = 'block';
        
        const zip = new JSZip();
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const item = selectedFiles[i];
            
            progressStatus.textContent = `変換中: ${item.file.name} (${i + 1}/${selectedFiles.length})`;
            progressBar.style.width = `${(i / selectedFiles.length) * 100}%`;
            
            item.status = 'converting';
            renderFileList();
            
            try {
                const buffer = await readFileSync(item.file);
                const dataUrl = await processTiff(buffer);
                item.dataUrl = dataUrl;
                item.status = 'done';
                
                // Add to zip
                const base64Data = dataUrl.split(',')[1];
                const newFilename = item.file.name.replace(/\.tiff?$/i, '.jpg');
                zip.file(newFilename, base64Data, {base64: true});
            } catch (err) {
                item.status = 'error';
            }
            
            renderFileList();
        }
        
        progressBar.style.width = '100%';
        progressStatus.textContent = 'ZIPファイルを作成中...';
        
        try {
            const content = await zip.generateAsync({type: 'blob'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            link.download = `converted_jpegs_${dateStr}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            progressStatus.textContent = '完了しました！';
            convertBtn.textContent = '完了';
            convertBtn.disabled = false;
            
            // 状態のリセット
            setTimeout(() => {
                selectedFiles = [];
                updateUI();
                progressArea.style.display = 'none';
                progressBar.style.width = '0%';
                convertBtn.textContent = '変換 & ZIPダウンロード';
            }, 3000);
            
        } catch (e) {
            progressStatus.textContent = 'ZIP作成中にエラーが発生しました';
            console.error(e);
            convertBtn.disabled = false;
        }
    });
});
