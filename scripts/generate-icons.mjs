import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function iconSvg(size, { maskable = false } = {}) {
	const radius = maskable ? 150 : 178;
	const fontSize = maskable ? 320 : 360;
	const textX = maskable ? 229 : 230;
	const baseline = maskable ? 371 : 385;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" fill="none">
	<rect width="512" height="512" fill="#000" />
	<circle cx="256" cy="256" r="${radius}" fill="none" stroke="#fff" stroke-width="12" opacity=".35" />
	<text x="${textX}" y="${baseline}" text-anchor="middle" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="600">€</text>
</svg>
`;
}

const assets = [
	['public/icons/icon-192.svg', 192, false],
	['public/icons/icon-512.svg', 512, false],
	['public/icons/icon-maskable.svg', 512, true],
	['public/favicon.svg', 32, false],
];

for (const [path, size, maskable] of assets) {
	writeFileSync(resolve(root, path), iconSvg(size, { maskable }), 'utf8');
}