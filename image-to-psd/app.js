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
  if (files.length !== 1) { message('�摜��1�������I��ł��������B', true); return; }
  const file = files[0];
  if (!/\.(png|jpe?g|webp)$/i.test(file.name) && !/^image\/(png|jpeg|webp)$/.test(file.type)) { message('PNG�EJPEG�EWebP�̉摜��I��ł��������B', true); return; }
  if (file.size > 100 * 1024 * 1024) { message('�t�@�C����100MB�ȓ��ɂ��Ă��������B', true); return; }
  message('�摜��ǂݍ���ł��܂��c');
  const url = URL.createObjectURL(file);
  const img = new Image(); img.src = url;
  try {
    await img.decode();
    if (token !== generation) { URL.revokeObjectURL(url); return; }
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h || w > 30000 || h > 30000 || w * h > 25000000) throw new Error('�摜�͊e��30,000px�ȓ��E���v2,500����f�ȓ��ɂ��Ă��������B');
    selected = { file, img, w, h }; previewURL = url; preview.src = url;
    document.getElementById('filename').textContent = file.name;
    document.getElementById('dimensions').textContent = `${w.toLocaleString()} �~ ${h.toLocaleString()} px`;
    result.hidden = false; download.disabled = false; message('�����ł��܂����BPSD���_�E�����[�h�ł��܂��B');
  } catch (error) { URL.revokeObjectURL(url); if (token === generation) message(error.message.includes('�摜��') ? error.message : '�摜��ǂݍ��߂܂���B�ʂ�PNG�EJPEG�EWebP�����������������B', true); }
}
fileInput.addEventListener('change', () => { load(Array.from(fileInput.files)); fileInput.value = ''; });
for (const event of ['dragenter', 'dragover']) drop.addEventListener(event, e => { e.preventDefault(); drop.classList.add('over'); });
for (const event of ['dragleave', 'drop']) drop.addEventListener(event, e => { e.preventDefault(); drop.classList.remove('over'); });
drop.addEventListener('drop', e => load(Array.from(e.dataTransfer.files)));
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => e.preventDefault());
download.addEventListener('click', async () => {
  if (!selected || busy) return;
  busy = true; download.disabled = true; fileInput.disabled = true; message('PSD���쐬���Ă��܂��c');
  await new Promise(resolve => setTimeout(resolve, 30));
  const canvas = document.createElement('canvas');
  try {
    const { file, img, w, h } = selected;
    canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
    if (!context) throw new Error('�摜�������J�n�ł��܂���ł����B');
    context.drawImage(img, 0, 0);
    const buffer = encodePSD(w, h, context.getImageData(0, 0, w, h).data);
    const url = URL.createObjectURL(new Blob([buffer], { type: 'image/vnd.adobe.photoshop' }));
    const a = document.createElement('a'); a.href = url; a.download = file.name.replace(/\.[^.]+$/, '') + '.psd';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    message('PSD���쐬���܂����B�_�E�����[�h������m�F���������B');
  } catch (error) { message('�ϊ��ł��܂���ł����B' + error.message, true); }
  finally { canvas.width = canvas.height = 0; busy = false; download.disabled = !selected; fileInput.disabled = false; }
});
