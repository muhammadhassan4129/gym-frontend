const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const publicDir = path.join(__dirname, '..', 'public');
const iconDir = path.join(publicDir, 'icons');

// Code-native icon: centered artwork stays inside the maskable safe zone.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b0e11"/>

  <circle
    cx="256"
    cy="256"
    r="174"
    fill="#141b15"
    stroke="#293523"
    stroke-width="3"
  />

  <g transform="rotate(-35 256 256)" fill="#bef264">
    <rect x="176" y="239" width="160" height="34" rx="12"/>

    <rect x="159" y="184" width="44" height="144" rx="14"/>
    <rect x="130" y="210" width="25" height="92" rx="9"/>

    <rect x="309" y="184" width="44" height="144" rx="14"/>
    <rect x="357" y="210" width="25" height="92" rx="9"/>
  </g>
</svg>
`;

async function main() {
  await fs.mkdir(iconDir, { recursive: true });

  const files = [
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['maskable-512.png', 512],
    ['apple-touch-icon.png', 180],
    ['favicon-32.png', 32],
  ];

  for (const [filename, size] of files) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(path.join(iconDir, filename));
  }

  await fs.writeFile(
    path.join(iconDir, 'gym-master.svg'),
    svg.trim()
  );

  console.log('Yaseen Gym PWA icons generated in public/icons');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});