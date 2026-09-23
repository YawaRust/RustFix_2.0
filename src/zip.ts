/**
 * Минимальный сборщик ZIP без внешних библиотек
 */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const h16 = (n: number) => Uint8Array.of(n & 255, (n >>> 8) & 255);
const h32 = (n: number) =>
  Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255);

export type ZipEntry = { name: string; data: Uint8Array };

export function makeZip(entries: ZipEntry[]): Blob {
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();

  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    const localParts = [
      h32(0x04034b50),
      h16(20),
      h16(0x0800),
      h16(0),
      h16(dosTime),
      h16(dosDate),
      h32(crc),
      h32(size),
      h32(size),
      h16(name.length),
      h16(0),
      name,
      e.data,
    ];

    let localLen = 0;
    for (const p of localParts) localLen += p.length;
    const localBuf = new Uint8Array(localLen);
    let curOff = 0;
    for (const p of localParts) {
      localBuf.set(p, curOff);
      curOff += p.length;
    }
    locals.push(localBuf);

    const centralParts = [
      h32(0x02014b50),
      h16(20),
      h16(20),
      h16(0x0800),
      h16(0),
      h16(dosTime),
      h16(dosDate),
      h32(crc),
      h32(size),
      h32(size),
      h16(name.length),
      h16(0),
      h16(0),
      h16(0),
      h16(0),
      h32(0),
      h32(offset),
      name,
    ];

    let centralLen = 0;
    for (const p of centralParts) centralLen += p.length;
    const centralBuf = new Uint8Array(centralLen);
    curOff = 0;
    for (const p of centralParts) {
      centralBuf.set(p, curOff);
      curOff += p.length;
    }
    centrals.push(centralBuf);

    offset += localLen;
  }

  const centralSize = centrals.reduce((a, p) => a + p.length, 0);
  const eocdParts = [
    h32(0x06054b50),
    h16(0),
    h16(0),
    h16(entries.length),
    h16(entries.length),
    h32(centralSize),
    h32(offset),
    h16(0),
  ];
  let eocdLen = 0;
  for (const p of eocdParts) eocdLen += p.length;
  const eocdBuf = new Uint8Array(eocdLen);
  let curOff = 0;
  for (const p of eocdParts) {
    eocdBuf.set(p, curOff);
    curOff += p.length;
  }

  const allParts: ArrayBuffer[] = [
    ...locals.map((l) => l.buffer as ArrayBuffer),
    ...centrals.map((c) => c.buffer as ArrayBuffer),
    eocdBuf.buffer as ArrayBuffer,
  ];

  return new Blob(allParts, { type: "application/zip" });
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
