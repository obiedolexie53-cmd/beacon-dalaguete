// Generates PWA icons from public/icons/beacon.svg. Run: pnpm icons
// The generated PNGs are committed so builds do not depend on sharp.
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const dir = new URL('../public/icons/', import.meta.url);
const svg = await readFile(new URL('beacon.svg', dir));

// Maskable icons need the artwork inside the central 80% "safe zone".
const maskableSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="#0b2545"/>
    <g transform="translate(9.6 9.6) scale(0.7)">${svg
      .toString()
      .replace(/<\/?svg[^>]*>/g, '')
      .replace('rx="16"', '')}</g>
  </svg>`,
);

const outputs = [
  ['pwa-192.png', svg, 192],
  ['pwa-512.png', svg, 512],
  ['maskable-512.png', maskableSvg, 512],
  ['apple-touch-icon-180.png', maskableSvg, 180],
];

for (const [name, source, size] of outputs) {
  await sharp(source, { density: 600 })
    .resize(size, size)
    .png()
    .toFile(new URL(name, dir).pathname);
  console.log(`wrote ${name}`);
}
