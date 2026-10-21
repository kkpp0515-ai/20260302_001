'use strict';
const fileInput = document.getElementById('file');
const drop = document.getElementById('drop');
const status = document.getElementById('status');
const result = document.getElementById('result');
const preview = document.getElementById('preview');
const download = document.getElementById('download');
let selected = null, previewURL = null, generation = 0, busy = false;
function message(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
async function load(files) {
  if (busy) return;
  const token = ++generation;
  selected = null; download.disabled = true; result.hidden = true;
  preview.removeAttribute('src');
  if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = null; }
  if (files.length !== 1) { message('画像を1枚だけ選んでください。', true); return; }
  const file = files[0];
  if (!/\.(png|jpe?g|webp)$/i.test(file.name) && !/^image\/(png|jpeg|webp)$/.test(file.type)) { message('PNG・JPEG・WebPの画像を選んでください。', true); return; }
  if (file.size > 100 * 1024 * 1024) { message('ファイルは100MB以内にしてください。', true); return; }
  message('画像を読み込んでいます…');
  const url = URL.createObjectURL(file);
  const img = new Image(); img.src = url;
  try {
    await img.decode();
    if (token !== generation) { URL.revokeObjectURL(url); return; }
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h || w > 30000 || h > 30000 || w * h > 25000000) throw new Error('画像は各辺30,000px以内・合計2,500万画素以内にしてください。');
    selected = { file, img, w, h }; previewURL = url; preview.src = url;
    document.getElementById('filename').textContent = file.name;
    document.getElementById('dimensions').textContent = `${w.toLocaleString()} × ${h.toLocaleString()} px`;
    result.hidden = false; download.disabled = false; message('準備できました。PSDをダウンロードできます。');
  } catch (error) { URL.revokeObjectURL(url); if (token === generation) message(error.message.includes('画像は') ? error.message : '画像を読み込めません。別のPNG・JPEG・WebPをお試しください。', true); }
}
fileInput.addEventListener('change', () => { load(Array.from(fileInput.files)); fileInput.value = ''; });
for (const event of ['dragenter', 'dragover']) drop.addEventListener(event, e => { e.preventDefault(); drop.classList.add('over'); });
for (const event of ['dragleave', 'drop']) drop.addEventListener(event, e => { e.preventDefault(); drop.classList.remove('over'); });
drop.addEventListener('drop', e => load(Array.from(e.dataTransfer.files)));
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => e.preventDefault());
download.addEventListener('click', async () => {
  if (!selected || busy) return;
  busy = true; download.disabled = true; fileInput.disabled = true; message('PSDを作成しています…');
  await new Promise(resolve => setTimeout(resolve, 30));
  const canvas = document.createElement('canvas');
  try {
    const { file, img, w, h } = selected;
    canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
    if (!context) throw new Error('画像処理を開始できませんでした。');
    context.drawImage(img, 0, 0);
    const buffer = encodePSD(w, h, context.getImageData(0, 0, w, h).data);
    const url = URL.createObjectURL(new Blob([buffer], { type: 'image/vnd.adobe.photoshop' }));
    const a = document.createElement('a'); a.href = url; a.download = file.name.replace(/\.[^.]+$/, '') + '.psd';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    message('PSDを作成しました。ダウンロード先をご確認ください。');
  } catch (error) { message('変換できませんでした。' + error.message, true); }
  finally { canvas.width = canvas.height = 0; busy = false; download.disabled = !selected; fileInput.disabled = false; }
});
