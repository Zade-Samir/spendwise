import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal CRC32 implementation
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([len, body, crcBuf]);
}

function createPng(width, height, isMaskable = false) {
  // Create RGBA pixel buffer
  // Each scanline: 1 byte filter type (0) + width * 4 bytes RGBA
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(rowBytes * height);

  const primaryR = 0x4F, primaryG = 0x46, primaryB = 0xE5; // #4F46E5 Indigo
  const bgDarkR = 0x37, bgDarkG = 0x30, bgDarkB = 0xA3; // #3730A3 Darker Indigo
  const whiteR = 0xFF, whiteG = 0xFF, whiteB = 0xFF;

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.44;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background gradient
      const t = y / height;
      const r = Math.round(primaryR * (1 - t) + bgDarkR * t);
      const g = Math.round(primaryG * (1 - t) + bgDarkG * t);
      const b = Math.round(primaryB * (1 - t) + bgDarkB * t);

      let alpha = 255;
      if (!isMaskable) {
        // Squircle / rounded box
        const cornerR = width * 0.22;
        const qx = Math.max(0, Math.abs(dx) - (cx - cornerR));
        const qy = Math.max(0, Math.abs(dy) - (cy - cornerR));
        const qDist = Math.sqrt(qx * qx + qy * qy);
        if (qDist > cornerR) {
          alpha = 0;
        } else if (qDist > cornerR - 1.5) {
          alpha = Math.max(0, Math.min(255, Math.round(255 * (cornerR - qDist) / 1.5)));
        }
      }

      // Draw stylized Rupee "₹" bars in the center
      // Normalize coords to [-1, 1] relative to center
      const nx = (x - cx) / (width * 0.3);
      const ny = (y - cy) / (height * 0.3);

      let isWhite = false;

      // Top horizontal bar: y in [-0.75, -0.55], x in [-0.65, 0.65]
      if (ny >= -0.75 && ny <= -0.55 && nx >= -0.65 && nx <= 0.65) {
        isWhite = true;
      }
      // Second horizontal bar: y in [-0.45, -0.25], x in [-0.65, 0.45]
      if (ny >= -0.45 && ny <= -0.25 && nx >= -0.65 && nx <= 0.45) {
        isWhite = true;
      }
      // Vertical left spine: x in [-0.65, -0.45], y in [-0.75, 0.75]
      if (nx >= -0.65 && nx <= -0.45 && ny >= -0.75 && ny <= 0.75) {
        isWhite = true;
      }
      // Upper loop curve of R / ₹: center around (-0.1, -0.35)
      const loopDx = nx - (-0.3);
      const loopDy = ny - (-0.35);
      const loopDist = Math.sqrt(loopDx * loopDx * 1.5 + loopDy * loopDy * 2.5);
      if (loopDist <= 0.42 && loopDist >= 0.22 && nx >= -0.45) {
        isWhite = true;
      }
      // Diagonal downward leg:
      if (ny >= -0.15 && ny <= 0.75) {
        const expectedX = -0.3 + (ny + 0.15) * 0.95;
        if (Math.abs(nx - expectedX) <= 0.12) {
          isWhite = true;
        }
      }

      if (isWhite && alpha > 0) {
        rawData[pxOffset] = whiteR;
        rawData[pxOffset + 1] = whiteG;
        rawData[pxOffset + 2] = whiteB;
        rawData[pxOffset + 3] = alpha;
      } else {
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = alpha;
      }
    }
  }

  // Header chunk
  const headerBuf = Buffer.alloc(13);
  headerBuf.writeUInt32BE(width, 0);
  headerBuf.writeUInt32BE(height, 4);
  headerBuf[8] = 8; // bit depth
  headerBuf[9] = 6; // color type: RGBA
  headerBuf[10] = 0; // compression
  headerBuf[11] = 0; // filter
  headerBuf[12] = 0; // interlace: none

  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = makeChunk('IHDR', headerBuf);
  const idat = makeChunk('IDAT', zlib.deflateSync(rawData, { level: 9 }));
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

const iconsDir = path.resolve('public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('Generating PNG icons...');
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), createPng(192, 192, false));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(iconsDir, 'icon-512-maskable.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon-180.png'), createPng(180, 180, false));
fs.writeFileSync(path.join(iconsDir, 'favicon.ico'), createPng(32, 32, false));
console.log('PNG icons created successfully in public/icons/');
