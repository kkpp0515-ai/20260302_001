'use strict';

// Store-only ZIP: images are already compressed. UTF-8 names preserve Japanese filenames.
function createZip(entries) {
  if (entries.length > 65535) throw new Error('一度に変換する画像を65535枚以下にしてください。');
  const encoder = new TextEncoder();
  const table = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const local = [], central = [];
  let offset = 0, centralSize = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name), data = entry.data;
    if (name.length > 65535 || offset + data.length + name.length + 30 > 0xffffffff) {
      throw new Error('ZIPの上限を超えました。画像を分けて選択してください。');
    }
    let crc = 0xffffffff;
    for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true);
    h.setUint16(6, 0x800, true); h.setUint16(12, 33, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    header.set(name, 30); local.push(header, data);
    const directory = new Uint8Array(46 + name.length), d = new DataView(directory.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true);
    d.setUint16(8, 0x800, true); d.setUint16(14, 33, true);
    d.setUint32(16, crc, true); d.setUint32(20, data.length, true);
    d.setUint32(24, data.length, true); d.setUint16(28, name.length, true);
    d.setUint32(42, offset, true); directory.set(name, 46); central.push(directory);
    offset += header.length + data.length; centralSize += directory.length;
  }
  if (offset + centralSize > 0xffffffff) throw new Error('ZIPが大きすぎます。画像を分けて選択してください。');
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true); e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: 'application/zip' });
}

function uniqueName(name, used) {
  const dot = name.lastIndexOf('.');
  const base = name.slice(0, dot), extension = name.slice(dot);
  let candidate = name, suffix = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${base}_${suffix++}${extension}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

async function resizeFile(file) {
  const extension = file.name.match(/\.(png|jpe?g|webp)$/i)?.[1]?.toLowerCase();
  if (!extension) throw new Error('PNG・JPEG・WebPの画像を選択してください。');
  if (!file.name.includes('1080-1080')) throw new Error('ファイル名に「1080-1080」がありません。');
  const mime = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  if (extension === 'png' || extension === 'webp') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const isPng = extension === 'png';
    for (let offset = isPng ? 8 : 12; offset + 8 <= bytes.length;) {
      const size = view.getUint32(offset + (isPng ? 0 : 4), !isPng);
      const typeOffset = offset + (isPng ? 4 : 0);
      const type = String.fromCharCode(...bytes.subarray(typeOffset, typeOffset + 4));
      if (type === 'acTL' || type === 'ANIM' || type === 'ANMF') {
        throw new Error('アニメーション画像には対応していません。静止画を選択してください。');
      }
      offset += isPng ? size + 12 : size + 8 + (size % 2);
      if (isPng && (type === 'IDAT' || type === 'IEND')) break;
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('画像を読み込めません。ファイルが破損していないか確認してください。'));
      img.src = url;
    });
    if (img.naturalWidth !== 1080 || img.naturalHeight !== 1080) {
      throw new Error(`サイズが${img.naturalWidth}×${img.naturalHeight}です（1080×1080のみ対応）。`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1200;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('このブラウザでは画像を変換できません。');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(img, 0, 0, 1200, 1200);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, 0.95));
    if (!blob || blob.type !== mime) throw new Error('このブラウザは元の画像形式での保存に対応していません。');
    return { name: file.name.replaceAll('1080-1080', '1200-1200'), blob };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const input = document.getElementById('files');
const dropZone = document.getElementById('drop-zone');
const status = document.getElementById('status');
const results = document.getElementById('results');
const download = document.getElementById('download');
let busy = false, downloadUrl;

async function processFiles(files) {
  if (busy || !files.length) return;
  busy = true;
  dropZone.disabled = input.disabled = true;
  results.replaceChildren();
  download.hidden = true;
  if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = undefined; }
  const converted = [], names = new Set();
  let failed = 0;
  try {
    for (let i = 0; i < files.length; i++) {
      status.textContent = `変換中… ${i + 1} / ${files.length}枚`;
      const row = document.createElement('li');
      try {
        const output = await resizeFile(files[i]);
        output.name = uniqueName(output.name, names);
        converted.push(output);
        row.textContent = `✓ ${files[i].name} → ${output.name}（1200×1200）`;
      } catch (error) {
        failed++;
        row.className = 'error';
        row.textContent = `スキップ：${files[i].name} — ${error.message}`;
      }
      results.append(row);
    }
    if (!converted.length) {
      status.textContent = '変換できる画像がありませんでした。下の理由を確認してください。';
      return;
    }
    let blob, filename;
    if (files.length === 1) {
      blob = converted[0].blob; filename = converted[0].name;
    } else {
      status.textContent = 'ZIPを作成中…';
      const entries = [];
      for (const output of converted) entries.push({ name: output.name, data: new Uint8Array(await output.blob.arrayBuffer()) });
      blob = createZip(entries); filename = 'images_1200-1200.zip';
    }
    downloadUrl = URL.createObjectURL(blob);
    download.href = downloadUrl;
    download.download = filename;
    download.hidden = false;
    download.click();
    status.textContent = `${converted.length}枚の変換が完了しました${failed ? `（${failed}枚スキップ）` : ''}。ダウンロードが始まらない場合は下のボタンを押してください。`;
  } catch (error) {
    status.textContent = `保存できませんでした：${error.message} 画像を分けて再度お試しください。`;
  } finally {
    busy = false;
    dropZone.disabled = input.disabled = false;
    input.value = '';
  }
}

dropZone.addEventListener('click', () => input.click());
input.addEventListener('change', () => processFiles(Array.from(input.files)));
for (const event of ['dragenter', 'dragover']) {
  dropZone.addEventListener(event, e => { e.preventDefault(); if (!busy) dropZone.classList.add('dragover'); });
}
for (const event of ['dragleave', 'drop']) {
  dropZone.addEventListener(event, e => { e.preventDefault(); dropZone.classList.remove('dragover'); });
}
dropZone.addEventListener('drop', e => processFiles(Array.from(e.dataTransfer.files)));
// Prevent the browser from navigating away when files land outside the drop zone.
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());
window.addEventListener('beforeunload', () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); });
