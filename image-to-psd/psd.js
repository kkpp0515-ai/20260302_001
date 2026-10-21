(function (root) {
  'use strict';
  // PSD v1, RGB/8, one unlocked layer and an RGBA merged image.
  function encodePSD(width, height, rgba) {
    const pixels = width * height;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 30000 || height > 30000 || pixels > 25000000) throw new Error('�摜�͊e��30,000px�ȓ��E���v2,500����f�ȓ��ɂ��Ă��������B');
    if (!rgba || rgba.length !== pixels * 4) throw new Error('�摜�f�[�^��ǂݎ��܂���ł����B');
    const layerInfoLength = 2 + 70 + 4 * (2 + pixels);
    const paddedLength = layerInfoLength + (layerInfoLength % 2);
    const buffer = new ArrayBuffer(26 + 4 + 4 + 4 + 4 + paddedLength + 4 + 2 + pixels * 4);
    const view = new DataView(buffer), bytes = new Uint8Array(buffer);
    let p = 0;
    const u8 = v => { view.setUint8(p, v); p++; };
    const u16 = v => { view.setUint16(p, v); p += 2; };
    const u32 = v => { view.setUint32(p, v); p += 4; };
    const str = v => { for (let i = 0; i < v.length; i++) u8(v.charCodeAt(i)); };
    str('8BPS'); u16(1); p += 6; u16(4); u32(height); u32(width); u16(8); u16(3);
    u32(0); u32(0); u32(4 + paddedLength + 4); u32(paddedLength);
    u16(65535); // Negative layer count: composite channel 4 is transparency.
    u32(0); u32(0); u32(height); u32(width); u16(4);
    for (const id of [0, 1, 2, 65535]) { u16(id); u32(2 + pixels); }
    str('8BIM'); str('norm'); u8(255); u8(0); u8(0); u8(0);
    u32(12); u32(0); u32(0); u8(3); str('Art');
    for (let c = 0; c < 4; c++) {
      u16(0);
      for (let i = 0; i < pixels; i++) bytes[p++] = rgba[i * 4 + c];
    }
    if (layerInfoLength % 2) p++;
    u32(0); u16(0);
    for (let c = 0; c < 4; c++) for (let i = 0; i < pixels; i++) bytes[p++] = rgba[i * 4 + c];
    if (p !== buffer.byteLength) throw new Error('PSD�̐����Ɏ��s���܂����B');
    return buffer;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { encodePSD };
  else root.encodePSD = encodePSD;
})(globalThis);
