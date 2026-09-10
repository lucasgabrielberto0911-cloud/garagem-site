/**
 * Gera screenshots do manifesto e splashes Apple a partir da marca.
 *
 *   node scripts/generate-pwa-assets.mjs
 *
 * Entrada: public/branding/logo-wordmark.webp + splash-iphone.png + icons.
 * Saída:   public/screenshots/{narrow,wide}.png
 *          public/branding/splash-{w}x{h}.png
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const branding = path.join(root, "public/branding");
const screenshots = path.join(root, "public/screenshots");

const BG = { r: 13, g: 13, b: 15, alpha: 1 };
const BRAND = { r: 232, g: 24, b: 28, alpha: 1 };
const CREAM = { r: 247, g: 245, b: 242, alpha: 1 };

function svgCard(x, y, w, h, title, price) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#17171A" stroke="rgba(255,255,255,0.12)"/>
      <rect x="${x}" y="${y}" width="${w}" height="${Math.round(h * 0.52)}" fill="#101012"/>
      <text x="${x + 18}" y="${y + Math.round(h * 0.68)}" fill="#F7F5F2" font-size="22" font-family="system-ui, sans-serif" font-weight="700">${title}</text>
      <text x="${x + 18}" y="${y + Math.round(h * 0.8)}" fill="#B4B4BA" font-size="16" font-family="system-ui, sans-serif">2018 · Automático · Cinza</text>
      <text x="${x + 18}" y="${y + Math.round(h * 0.92)}" fill="#F7F5F2" font-size="20" font-family="system-ui, sans-serif" font-weight="700">${price}</text>
    </g>`;
}

async function composeStoreShot({
  width,
  height,
  file,
  label,
}) {
  const logo = await sharp(path.join(branding, "logo-wordmark.webp"))
    .resize({ width: Math.round(width * 0.42), withoutEnlargement: true })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const logoW = logoMeta.width ?? 200;
  const logoH = logoMeta.height ?? 40;

  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0D0D0F"/>
      <text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.22)}" fill="#F7F5F2" font-size="${Math.round(width * 0.055)}" font-family="system-ui, sans-serif" font-weight="800">${label}</text>
      <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.245)}" width="${Math.round(width * 0.12)}" height="6" fill="#E8181C"/>
      ${svgCard(Math.round(width * 0.08), Math.round(height * 0.3), Math.round(width * 0.4), Math.round(height * 0.28), "Honda HR-V", "R$ 89.900")}
      ${svgCard(Math.round(width * 0.52), Math.round(height * 0.3), Math.round(width * 0.4), Math.round(height * 0.28), "Honda Biz 125", "R$ 17.900")}
      <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.66)}" width="${Math.round(width * 0.84)}" height="${Math.round(height * 0.08)}" fill="#E8181C"/>
      <text x="${Math.round(width * 0.5)}" y="${Math.round(height * 0.71)}" text-anchor="middle" fill="#F7F5F2" font-size="${Math.round(width * 0.032)}" font-family="system-ui, sans-serif" font-weight="700">TENHO INTERESSE</text>
      <text x="${Math.round(width * 0.5)}" y="${Math.round(height * 0.9)}" text-anchor="middle" fill="#B4B4BA" font-size="${Math.round(width * 0.022)}" font-family="system-ui, sans-serif">suagaragem.net · seminovos no ES</text>
    </svg>
  `);

  const base = sharp({
    create: { width, height, channels: 4, background: BG },
  }).composite([
    { input: svg, top: 0, left: 0 },
    {
      input: logo,
      top: Math.round(height * 0.14 - logoH / 2),
      left: Math.round(width * 0.5 - logoW / 2),
    },
  ]);

  await base.png({ compressionLevel: 9 }).toFile(path.join(screenshots, file));
}

async function splashSize(width, height, dest) {
  const source = path.join(branding, "splash-iphone.png");
  await sharp(source)
    .resize(width, height, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(branding, dest));
}

await mkdir(screenshots, { recursive: true });
await composeStoreShot({
  width: 1080,
  height: 1920,
  file: "narrow.png",
  label: "Seminovos no ES",
});
await composeStoreShot({
  width: 1920,
  height: 1080,
  file: "wide.png",
  label: "Seminovos no ES",
});

const splashes = [
  [750, 1334],
  [828, 1792],
  [1125, 2436],
  [1170, 2532],
  [1284, 2778],
  [1290, 2796],
];
for (const [w, h] of splashes) {
  await splashSize(w, h, `splash-${w}x${h}.png`);
}

await writeFile(
  path.join(screenshots, "README.md"),
  `# Screenshots PWA

Arquivos usados no \`manifest.webmanifest\` (Instalar app).

- \`narrow.png\` — 1080×1920 (celular)
- \`wide.png\` — 1920×1080 (desktop)

Para regenerar a partir da marca (logo + splash atuais):

\`\`\`bash
node scripts/generate-pwa-assets.mjs
\`\`\`

Os splashes Apple extras ficam em \`public/branding/splash-{largura}x{altura}.png\`.
O fallback continua sendo \`splash-iphone.png\` (1170×2532). iPhones novos sem
media query específica usam esse fallback.
`,
);

console.log("PWA screenshots e splashes gerados.");
void CREAM;
void BRAND;
