import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const quickCheck = process.argv.includes('--quick');

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

const port = Number(process.env.THEME_CHECK_PORT || (process.env.THEME_CHECK_URL ? 4322 : await findAvailablePort()));
const repositoryOwner = process.env.GITHUB_REPOSITORY_OWNER;
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isUserSite = repositoryOwner && repositoryName === `${repositoryOwner}.github.io`;
const pagesBase = process.env.GITHUB_PAGES === 'true' && repositoryName && !isUserSite
	? `/${repositoryName}/`
	: '/';
const baseUrl = process.env.THEME_CHECK_URL || `http://127.0.0.1:${port}${pagesBase}`;
const screenshotRoot = resolve(root, 'test-output/theme-matrix');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const runDirectory = join(screenshotRoot, 'runs', runId);
const galleryPath = join(screenshotRoot, 'index.html');
const screenshots = [];
const palettes = ['minimal', 'euro', 'market', 'coffee', 'fruitshop', 'butcher'];
const allBrowserEngines = [
	{ name: 'chromium', type: chromium },
	{ name: 'firefox', type: firefox },
	{ name: 'webkit', type: webkit },
];
const allAppearances = [
	{ value: 'system', colorScheme: 'light' },
	{ value: 'system', colorScheme: 'dark' },
	{ value: 'light', colorScheme: 'light' },
	{ value: 'dark', colorScheme: 'dark' },
];
const browserEngines = quickCheck ? allBrowserEngines.slice(0, 1) : allBrowserEngines;
const appearances = quickCheck
	? allAppearances.filter(({ value }) => value !== 'system')
	: allAppearances;
const layouts = ['compact', 'large'];
const viewports = [
	{ name: 'mobile', width: 375, height: 812 },
	{ name: 'desktop', width: 1280, height: 900 },
];

let server;
let serverError;
let serverExitCode = null;
let browser;
let checked = 0;

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

async function waitForServer() {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		if (serverError) throw serverError;
		if (serverExitCode !== null) throw new Error(`Astro exited with code ${serverExitCode}`);
		try {
			const response = await fetch(baseUrl);
			if (response.ok) return;
		} catch {}
		await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
	}
	throw new Error(`Timed out waiting for Astro preview at ${baseUrl}`);
}

async function stopServer() {
	if (!server || server.exitCode !== null) return;
	server.kill();
	await Promise.race([
		once(server, 'exit'),
		new Promise((resolveDelay) => setTimeout(resolveDelay, 3000)),
	]);
}

try {
	if (!quickCheck) await mkdir(runDirectory, { recursive: true });
	if (!process.env.THEME_CHECK_URL) await buildSite();

	if (!process.env.THEME_CHECK_URL) {
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
		server.on('error', (error) => {
			serverError = error;
		});
		server.on('exit', (code) => {
			serverExitCode = code;
		});
		await waitForServer();
	}

async function runBrowserMatrix(browserEngine) {
	browser = await browserEngine.type.launch({ headless: true });
	const page = await browser.newPage({ viewport: viewports[0] });
	await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
	await page.locator('details.settings-menu').evaluate((menu) => {
		menu.open = true;
	});

	const paletteOptions = page.locator('[data-palette-choice]');
	const languageOptions = page.locator('[data-locale-choice]');
	const appearanceOptions = page.locator('[data-theme-choice]');
	const largeToggle = page.locator('[data-large-toggle]');
	const availablePalettes = await paletteOptions.evaluateAll((options) =>
		options.map((option) => option.getAttribute('data-palette-choice')),
	);
	assert.deepEqual(availablePalettes, palettes, 'Palette selector and checker are out of sync');
	assert.deepEqual(
		await languageOptions.evaluateAll((options) => options.map((option) => option.getAttribute('data-locale-choice'))),
		['en', 'es'],
		'Language choices and checker are out of sync',
	);
	assert.deepEqual(
		await appearanceOptions.evaluateAll((options) => options.map((option) => option.getAttribute('data-theme-choice'))),
		['system', 'light', 'dark'],
		'Appearance choices and checker are out of sync',
	);

	const styleSignatures = new Map();

	for (const viewport of viewports) {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		for (const palette of palettes) {
			for (const appearance of appearances) {
				await page.emulateMedia({ colorScheme: appearance.colorScheme });
				for (const layout of layouts) {
					const locale = palettes.indexOf(palette) % 2 === 0 ? 'en' : 'es';
					await page.locator(`[data-locale-choice="${locale}"]`).click();
					const paletteOption = page.locator(`[data-palette-choice="${palette}"]`);
					await paletteOption.click();
					await page.locator(`[data-theme-choice="${appearance.value}"]`).click();
					await largeToggle.evaluate((input, checked) => {
						input.checked = checked;
						input.dispatchEvent(new Event('change', { bubbles: true }));
					}, layout === 'large');

					const styles = await page.evaluate(() => {
						const rootElement = document.documentElement;
						const body = document.body;
						const heading = document.querySelector('.counter__section-title');
						const list = document.querySelector('.counter__list');
						const row = document.querySelector('[data-row]');
						const coin = row?.querySelector('.row__swatch--coin');
						const note = document.querySelector('[data-kind="note"] .row__swatch--note');
						const controls = row?.querySelector('.row__controls');
						const paletteOption = document.querySelector('[data-palette-choice][aria-checked="true"]');
						const palettePreview = paletteOption?.querySelector('[data-palette-preview]');
						const bodyStyle = getComputedStyle(body);
						const rowStyle = row ? getComputedStyle(row) : null;
						const coinStyle = coin ? getComputedStyle(coin) : null;
						const noteStyle = note ? getComputedStyle(note) : null;
						const controlStyle = controls ? getComputedStyle(controls) : null;
						const rows = Array.from(document.querySelectorAll('[data-row]'));
						const paletteOptionStyle = paletteOption ? getComputedStyle(paletteOption) : null;
						return {
							palette: rootElement.dataset.palette,
							locale: rootElement.lang,
							theme: rootElement.dataset.theme || 'system',
							appearanceChoice: document.querySelector('[data-theme-choice][aria-checked="true"]')?.getAttribute('data-theme-choice'),
							layout: document.querySelector('[data-money-counter]')?.getAttribute('data-layout'),
							background: bodyStyle.backgroundColor,
							font: bodyStyle.fontFamily,
							headingFont: heading ? getComputedStyle(heading).fontFamily : '',
							rowRadius: rowStyle?.borderRadius,
							rowPadding: rowStyle?.padding,
							rowBackground: rowStyle?.backgroundColor,
							listDisplay: list ? getComputedStyle(list).display : '',
							coin: coinStyle && {
								width: coinStyle.width,
								background: coinStyle.backgroundColor,
								image: coinStyle.backgroundImage,
								radius: coinStyle.borderRadius,
								after: getComputedStyle(coin, '::after').content,
							},
							note: noteStyle && {
								background: noteStyle.backgroundColor,
								radius: noteStyle.borderRadius,
							},
							controlRadius: controlStyle?.borderRadius,
							optionRadius: paletteOptionStyle?.borderRadius,
							optionFont: paletteOptionStyle?.fontFamily,
							optionBackground: paletteOptionStyle?.backgroundColor,
							previewBackground: palettePreview ? getComputedStyle(palettePreview).backgroundColor : '',
							selectedOption: paletteOption?.getAttribute('data-palette-choice'),
							checkedOption: paletteOption?.getAttribute('aria-checked'),
							horizontalOverflow: rootElement.scrollWidth > window.innerWidth,
							denominationBackgrounds: rows.map((item) => getComputedStyle(item).backgroundColor),
						};
					});

					const combination = `${palette}/${appearance.value}-${appearance.colorScheme}/${layout}/${viewport.name}`;
					assert.equal(styles.palette, palette, `${combination}: palette did not apply`);
					assert.equal(styles.locale, locale, `${combination}: language did not apply`);
					assert.equal(styles.theme, appearance.value, `${combination}: appearance did not apply`);
					assert.equal(styles.appearanceChoice, appearance.value, `${combination}: appearance selection is wrong`);
					assert.equal(styles.layout, layout, `${combination}: control size did not apply`);
					assert.ok(styles.background !== 'rgba(0, 0, 0, 0)', `${combination}: body has no background`);
					assert.ok(styles.font, `${combination}: body font is missing`);
					assert.ok(styles.rowRadius !== undefined && styles.rowPadding, `${combination}: row tokens are missing`);
					assert.ok(styles.coin && Number.parseFloat(styles.coin.width) > 0, `${combination}: coin mark is missing`);
					assert.ok(styles.note && styles.note.background !== 'rgba(0, 0, 0, 0)', `${combination}: note style is missing`);
					assert.ok(styles.controlRadius !== undefined && styles.optionRadius, `${combination}: control tokens are missing`);
					assert.ok(styles.optionFont && styles.optionBackground, `${combination}: palette option styling is missing`);
					assert.equal(styles.selectedOption, palette, `${combination}: palette preview selection is wrong`);
					assert.equal(styles.checkedOption, 'true', `${combination}: selected palette is not announced`);
					assert.notEqual(styles.previewBackground, 'rgba(0, 0, 0, 0)', `${combination}: palette preview is blank`);
					const keepsMinimalRows = palette === 'minimal' && layout === 'large';
					const expectedListDisplay = !keepsMinimalRows && (viewport.name === 'desktop' || layout === 'large')
						? 'grid'
						: 'block';
					assert.equal(styles.listDisplay, expectedListDisplay, `${combination}: row layout is incorrect`);
					assert.equal(styles.horizontalOverflow, false, `${combination}: page overflows horizontally`);
					if (palette !== 'minimal') {
						assert.ok(new Set(styles.denominationBackgrounds).size > 1, `${combination}: denominations lack distinct surfaces`);
					}

					if (viewport.name === 'mobile' && appearance.value === 'light' && layout === 'compact') {
						styleSignatures.set(
							palette,
							JSON.stringify([
								styles.font,
								styles.headingFont,
								styles.rowRadius,
								styles.rowPadding,
								styles.controlRadius,
								styles.optionRadius,
								styles.optionFont,
								styles.coin?.width,
								styles.coin?.radius,
								styles.note?.radius,
							]),
						);
					}

					const appearanceName = appearance.value === 'system'
						? `system-${appearance.colorScheme}`
						: appearance.value;
					if (!quickCheck) {
						const fileName = `${browserEngine.name}-${viewport.name}-${palette}-${appearanceName}-${layout}.png`;
						const imagePath = `runs/${runId}/${fileName}`;
						await page.locator('details.settings-menu').evaluate((menu) => {
							menu.open = false;
						});
						await page.evaluate(() => window.scrollTo(0, 0));
						await page.screenshot({
							path: join(runDirectory, fileName),
							fullPage: true,
							animations: 'disabled',
						});
						screenshots.push({ engine: browserEngine.name, palette, appearance: appearanceName, layout, viewport: viewport.name, imagePath });
						await page.locator('details.settings-menu').evaluate((menu) => {
							menu.open = true;
						});
					}
					checked += 1;
				}
			}
		}
	}

	assert.equal(new Set(styleSignatures.values()).size, palettes.length, 'Each palette should have a distinct structural style');
	await browser.close();
	browser = undefined;
}

for (const browserEngine of browserEngines) {
	await runBrowserMatrix(browserEngine);
}

	if (quickCheck) {
		console.log(`Verified ${checked} quick-check combinations: ${palettes.length} presets x ${appearances.length} appearances x ${layouts.length} layouts x ${viewports.length} viewports x ${browserEngines.length} browser. No screenshots generated.`);
	} else {
		assert.equal(screenshots.length, checked, 'A screenshot is missing for one or more combinations');
const galleryCards = screenshots.map(({ engine, palette, appearance, layout, viewport, imagePath }) => `
		<figure>
			<a href="${imagePath}" target="_blank" rel="noreferrer"><img src="${imagePath}" alt="${engine}, ${palette}, ${appearance}, ${layout}, ${viewport}" loading="lazy" /></a>
			<figcaption><strong>${palette}</strong><span>${engine} / ${appearance} / ${layout} / ${viewport}</span></figcaption>
		</figure>`).join('');
	const gallery = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Money Counter theme screenshots</title>
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
			<h1>Money Counter theme matrix</h1>
			<p>${checked} screenshots · ${runId} · select a thumbnail to open the full image</p>
			<div class="grid">${galleryCards}
			</div>
		</main>
	</body>
</html>
`;
	await writeFile(galleryPath, gallery, 'utf8');
	console.log(`Verified ${checked} combinations: ${palettes.length} presets x ${appearances.length} appearance modes x ${layouts.length} layouts x ${viewports.length} viewports x ${browserEngines.length} browsers.`);
	console.log(`Screenshot gallery: ${galleryPath}`);
	}
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
