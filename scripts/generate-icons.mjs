// One-off: rasterizes the SVG icons in public/ into the PNGs a PWA manifest
// and iOS actually need (neither reliably reads SVG for a home-screen icon).
// Not part of the build — run by hand whenever an icon source changes.
import sharp from "sharp";

const jobs = [
  ["public/icon.svg", "public/icon-192.png", 192],
  ["public/icon.svg", "public/icon-512.png", 512],
  ["public/icon-maskable.svg", "public/icon-maskable-512.png", 512],
  ["public/icon-apple.svg", "public/apple-touch-icon.png", 180],
];

for (const [src, out, size] of jobs) {
  await sharp(src).resize(size, size).png().toFile(out);
  console.log(`${out} (${size}x${size})`);
}
