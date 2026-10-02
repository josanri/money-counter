import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const palettes = ['minimal', 'swiss', 'neo', 'market', 'coffee', 'fruitshop', 'butcher'];
const appearances = [
	{ value: 'system', colorScheme: 'light', name: 'system-light' },
	{ value: 'system', colorScheme: 'dark', name: 'system-dark' },
	{ value: 'light', colorScheme: 'light', name: 'light' },
	{ value: 'dark', colorScheme: 'dark', name: 'dark' },
];
const layouts = ['compact', 'large'];
const viewports = [
	{ name: 'mobile', width: 375, height: 812 },
	{ name: 'desktop', width: 1280, height: 900 },
];
const outputRoot = resolve(root, 'visual-output/theme-gallery');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runDirectory = join(outputRoot, 'runs', runId);
const galleryPath = join(outputRoot, 'index.html');
const repositoryOwner = process.env.GITHUB_REPOSITORY_OWNER;
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isUserSite = repositoryOwner && repositoryName === `${repositoryOwner}.github.io`;
const pagesBase = process.env.GITHUB_PAGES === 'true' && repositoryName && !isUserSite
	? `/${repositoryName}/`
	: '/';
let imageToWebp;

try {
	const { default: sharp } = await import('sharp');
	imageToWebp = (buffer, path) => sharp(buffer).webp({ quality: 84, effort: 4 }).toFile(path);
} catch {
	// Keep PNG screenshots if the optional WebP encoder is not installed.
}

async function findAvailablePort() {
	const listener = createServer();
	await new Promise((resolveListen, reject) => {
		listener.once('error', reject);
		listener.listen(0, '127.0.0.1', resolveListen);
	});
	const address = listener.address();
	if (!address || typeof address === 'string') throw new Error('Could not reserve a local port');
	await new Promise((resolveClose) => listener.close(resolveClose));
	return address.port;
}

async function buildSite() {
	await new Promise((resolveBuild, rejectBuild) => {
		const build = spawn(process.execPath, [resolve(root, 'node_modules/astro/bin/astro.mjs'), 'build'], {
			cwd: root,
			stdio: 'inherit',
			windowsHide: true,
		});
		build.once('error', rejectBuild);
		build.once('exit', (code) => {
			if (code === 0) resolveBuild();
			else rejectBuild(new Error(`Astro build exited with code ${code}`));
		});
	});
}

async function waitForServer(url, server) {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		if (server?.exitCode !== null && server?.exitCode !== undefined) {
			throw new Error(`Astro preview exited with code ${server.exitCode}`);
		}
		try {
			const response = await fetch(url);
			if (response.ok) return;
		} catch {}
		await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
	}
	throw new Error(`Timed out waiting for Astro preview at ${url}`);
}

let server;
let browser;
const screenshots = [];

try {
	await mkdir(runDirectory, { recursive: true });
	let baseUrl = process.env.THEME_GALLERY_URL;
	if (!baseUrl) {
		await buildSite();
		const port = await findAvailablePort();
		baseUrl = `http://127.0.0.1:${port}${pagesBase}`;
		server = spawn(
			process.execPath,
			[
				resolve(root, 'node_modules/astro/bin/astro.mjs'),
				'preview',
				'--host',
				'127.0.0.1',
				'--port',
				String(port),
			],
			{ cwd: root, stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true },
		);
		await waitForServer(baseUrl, server);
	}

	browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: viewports[0] });
	await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
	const settings = page.locator('details.settings-menu');
	const largeToggle = page.locator('[data-large-toggle]');

	// Give each theme a small non-zero example so the gallery shows its active-row styling.
	await page.locator('[data-key="2.00"] [data-inc]').click();
	await page.locator('[data-key="20.00"] [data-inc]').click();

	for (const viewport of viewports) {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		for (const [paletteIndex, palette] of palettes.entries()) {
			const locale = paletteIndex % 2 === 0 ? 'en' : 'es';
			for (const appearance of appearances) {
				await page.emulateMedia({ colorScheme: appearance.colorScheme });
				for (const layout of layouts) {
					await settings.evaluate((menu) => { menu.open = true; });
					await page.locator(`[data-locale-choice="${locale}"]`).click();
					await page.locator('[data-customize-open]').click();
					await page.locator(`[data-palette-choice="${palette}"]`).click();
					await page.locator(`[data-theme-choice="${appearance.value}"]`).click();
					await largeToggle.evaluate((input, checked) => {
						input.checked = checked;
						input.dispatchEvent(new Event('change', { bubbles: true }));
					}, layout === 'large');
					await page.locator('[data-customize-close]').click();
					await settings.evaluate((menu) => { menu.open = false; });
					await page.waitForTimeout(100);

					const fileStem = `${viewport.name}-${palette}-${appearance.name}-${layout}`;
					const imageType = imageToWebp ? 'webp' : 'png';
					const fileName = `${fileStem}.${imageType}`;
					const imagePath = `runs/${runId}/${fileName}`;
					const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
					if (imageToWebp) await imageToWebp(screenshot, join(runDirectory, fileName));
					else await writeFile(join(runDirectory, fileName), screenshot);
					screenshots.push({ palette, appearance: appearance.name, layout, viewport: viewport.name, locale, imagePath });
				}
			}
		}
	}

	const galleryCards = screenshots.map(({ palette, appearance, layout, viewport, locale, imagePath }) => `
		<figure>
			<a href="${imagePath}" target="_blank" rel="noreferrer"><img src="${imagePath}" alt="${palette}, ${appearance}, ${layout}, ${viewport}, ${locale}" loading="lazy" /></a>
			<figcaption><strong>${palette}</strong><span>${appearance} / ${layout} / ${viewport} / ${locale}</span></figcaption>
		</figure>`).join('');
	const gallery = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Money Counter theme gallery</title>
		<style>
			:root { color-scheme: dark; font-family: system-ui, sans-serif; background: #111; color: #f4f4f4; }
			body { margin: 0; }
			main { max-width: 1440px; margin: 0 auto; padding: 24px; }
			h1 { margin: 0 0 8px; font-size: 1.25rem; }
			p { margin: 0 0 20px; color: #aaa; font-size: 0.875rem; }
			.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
			figure { min-width: 0; margin: 0; padding: 8px; border: 1px solid #383838; background: #080808; }
			img { display: block; width: 100%; height: 260px; object-fit: cover; object-position: top; background: #222; }
			figcaption { display: grid; gap: 4px; padding-top: 8px; font-size: 0.75rem; text-transform: capitalize; }
			figcaption span { color: #aaa; font-size: 0.6875rem; }
			@media (max-width: 560px) { main { padding: 14px; } .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } img { height: 210px; } }
		</style>
	</head>
	<body>
		<main>
			<h1>Money Counter theme gallery</h1>
			<p>${screenshots.length} visual previews · ${runId} · select a thumbnail to open the full image</p>
			<div class="grid">${galleryCards}</div>
		</main>
	</body>
</html>
`;
	await writeFile(galleryPath, gallery, 'utf8');
	console.log(`Generated ${screenshots.length} visual previews in ${galleryPath}`);
} finally {
	await browser?.close();
	if (server && server.exitCode === null) {
		server.kill();
		await Promise.race([
			once(server, 'exit'),
			new Promise((resolveDelay) => setTimeout(resolveDelay, 3000)),
		]);
	}
}
