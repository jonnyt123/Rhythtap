import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';

const sourceDir = path.resolve('dist-itch');
const outputDir = path.resolve('artifacts');
const outputFile = path.join(outputDir, 'rhythmtap-itch.zip');

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimeDate(date) {
  const year = Math.max(1980, date.getFullYear());
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const day = ((year - 1980) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

async function collectFiles(dir, root = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute, root));
    if (entry.isFile()) files.push({ absolute, relative: path.relative(root, absolute).split(path.sep).join('/') });
  }
  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

async function verifyBuild() {
  const indexPath = path.join(sourceDir, 'index.html');
  const html = await readFile(indexPath, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map(match => match[1]);

  const rootAbsolute = refs.filter(ref => ref.startsWith('/') && !ref.startsWith('//'));
  if (rootAbsolute.length) {
    throw new Error(`itch.io build contains root-absolute asset URLs: ${rootAbsolute.join(', ')}`);
  }

  for (const ref of refs) {
    if (/^(?:https?:|data:|mailto:|tel:|#)/i.test(ref)) continue;
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean || clean === './') continue;
    const resolved = path.resolve(sourceDir, clean);
    if (!resolved.startsWith(sourceDir)) throw new Error(`Invalid build reference outside dist-itch: ${ref}`);
    try {
      await stat(resolved);
    } catch {
      throw new Error(`Missing file referenced by index.html: ${ref}`);
    }
  }
}

async function makeZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const data = await readFile(file.absolute);
    const compressed = deflateRawSync(data, { level: 6 });
    const name = Buffer.from(file.relative, 'utf8');
    const checksum = crc32(data);
    const { mtime } = await stat(file.absolute);
    const { time, day } = dosTimeDate(mtime);
    const flags = 0x0800;
    const method = 8;

    const local = Buffer.alloc(30 + name.length);
    let p = 0;
    local.writeUInt32LE(0x04034b50, p); p += 4;
    local.writeUInt16LE(20, p); p += 2;
    local.writeUInt16LE(flags, p); p += 2;
    local.writeUInt16LE(method, p); p += 2;
    local.writeUInt16LE(time, p); p += 2;
    local.writeUInt16LE(day, p); p += 2;
    local.writeUInt32LE(checksum, p); p += 4;
    local.writeUInt32LE(compressed.length, p); p += 4;
    local.writeUInt32LE(data.length, p); p += 4;
    local.writeUInt16LE(name.length, p); p += 2;
    local.writeUInt16LE(0, p); p += 2;
    name.copy(local, p);

    chunks.push(local, compressed);

    const header = Buffer.alloc(46 + name.length);
    p = 0;
    header.writeUInt32LE(0x02014b50, p); p += 4;
    header.writeUInt16LE(20, p); p += 2;
    header.writeUInt16LE(20, p); p += 2;
    header.writeUInt16LE(flags, p); p += 2;
    header.writeUInt16LE(method, p); p += 2;
    header.writeUInt16LE(time, p); p += 2;
    header.writeUInt16LE(day, p); p += 2;
    header.writeUInt32LE(checksum, p); p += 4;
    header.writeUInt32LE(compressed.length, p); p += 4;
    header.writeUInt32LE(data.length, p); p += 4;
    header.writeUInt16LE(name.length, p); p += 2;
    header.writeUInt16LE(0, p); p += 2;
    header.writeUInt16LE(0, p); p += 2;
    header.writeUInt16LE(0, p); p += 2;
    header.writeUInt16LE(0, p); p += 2;
    header.writeUInt32LE(0, p); p += 4;
    header.writeUInt32LE(offset, p); p += 4;
    name.copy(header, p);
    central.push(header);

    offset += local.length + compressed.length;
  }

  const centralOffset = offset;
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  let p = 0;
  end.writeUInt32LE(0x06054b50, p); p += 4;
  end.writeUInt16LE(0, p); p += 2;
  end.writeUInt16LE(0, p); p += 2;
  end.writeUInt16LE(files.length, p); p += 2;
  end.writeUInt16LE(files.length, p); p += 2;
  end.writeUInt32LE(centralSize, p); p += 4;
  end.writeUInt32LE(centralOffset, p); p += 4;
  end.writeUInt16LE(0, p);

  return Buffer.concat([...chunks, ...central, end]);
}

await verifyBuild();
const files = await collectFiles(sourceDir);
if (!files.some(file => file.relative === 'index.html')) throw new Error('itch.io package must contain index.html at the ZIP root.');

await mkdir(outputDir, { recursive: true });
const archive = await makeZip(files);
await writeFile(outputFile, archive);

console.log(`itch.io package ready: ${path.relative(process.cwd(), outputFile)}`);
console.log(`Files: ${files.length}`);
console.log(`ZIP size: ${(archive.length / 1024 / 1024).toFixed(2)} MiB`);
