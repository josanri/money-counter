import { DENOMINATIONS_BY_CURRENCY } from '../lib/denominations';
import { toClientStrings } from '../i18n/messages';

const STORAGE_COUNTS = 'money-counter-counts-v1';
const STORAGE_MANUAL_ADJUSTMENT = 'money-counter-manual-adjustment-v1';
const STORAGE_LOCALE = 'money-counter-locale-v1';
const STORAGE_LAYOUT = 'money-counter-layout-v1';
const STORAGE_THEME = 'money-counter-theme-v1';
const STORAGE_PALETTE = 'money-counter-palette-v1';
const STORAGE_CURRENCY = 'money-counter-currency-v1';
const STORAGE_INSTALL_DISMISS = 'money-counter-install-dismiss-v1';

const i18n = {
	en: toClientStrings('en'),
	es: toClientStrings('es'),
};

const root = document.querySelector('[data-money-counter]');
const toolbar = document.querySelector('[data-app-toolbar]');
const installBar = document.querySelector('[data-install-bar]');
if (!root || !toolbar || !installBar) throw new Error('App shell missing');

const totalEl = root.querySelector('[data-total]');
const totalDisplay = root.querySelector('[data-total-display]');
const totalMeasureContext = document.createElement('canvas').getContext('2d');
const resetBtn = root.querySelector('[data-reset]');
const installBtn = installBar.querySelector('[data-install]');
const installBody = installBar.querySelector('[data-install-body]');
const installDismiss = installBar.querySelector('[data-install-dismiss]');
const settingsInstallWrap = toolbar.querySelector('[data-settings-install-wrap]');
const settingsInstallButton = toolbar.querySelector('[data-settings-install]');
const settingsInstallHelp = toolbar.querySelector('[data-settings-install-help]');
const largeToggle = toolbar.querySelector('[data-large-toggle]');
const localeButtons = toolbar.querySelectorAll('[data-locale-choice]');
const themeButtons = toolbar.querySelectorAll('[data-theme-choice]');
const paletteButtons = toolbar.querySelectorAll('[data-palette-choice]');
const currencyButtons = root?.querySelectorAll('[data-currency-choice]') ?? [];

let currency = loadCurrency();
let counts = loadCounts(currency);
let manualAdjustmentCents = loadManualAdjustment(currency);
let locale = loadLocale();
let layout = loadLayout();
let theme = loadTheme();
let palette = loadPalette();
let deferredInstall = null;
let installHelp = false;
let settingsInstallHelpKey = null;
let lastTotalCents = null;
let displayedTotalCents = null;
let totalAnimationFrame = 0;

function currencyStorageKey(key, currencyCode) {
	return currencyCode === 'EUR' ? key : `${key}-${currencyCode}`;
}

function activeDenominations(currencyCode = currency) {
	return DENOMINATIONS_BY_CURRENCY[currencyCode];
}

function valueMap(currencyCode = currency) {
	return new Map(activeDenominations(currencyCode).map((denomination) => [
		currencyCode === 'EUR' ? denomination.value.toFixed(2) : denomination.id,
		denomination.value,
	]));
}

function mapCountsToCurrency(sourceCounts, sourceCurrency, targetCurrency) {
	const targets = new Map(activeDenominations(targetCurrency).map((denomination) => [
		`${denomination.kind}:${denomination.value.toFixed(2)}`,
		denomination,
	]));
	const mappedCounts = {};
	for (const denomination of activeDenominations(sourceCurrency)) {
		const sourceKey = sourceCurrency === 'EUR' ? denomination.value.toFixed(2) : denomination.id;
		const count = sourceCounts[sourceKey];
		if (!Number.isSafeInteger(count) || count <= 0) continue;
		const target = targets.get(`${denomination.kind}:${denomination.value.toFixed(2)}`);
		if (!target) continue;
		const targetKey = targetCurrency === 'EUR' ? target.value.toFixed(2) : target.id;
		mappedCounts[targetKey] = count;
	}
	return mappedCounts;
}

let valueByKey = valueMap();

function loadCurrency() {
	try {
		return localStorage.getItem(STORAGE_CURRENCY) === 'USD' ? 'USD' : 'EUR';
	} catch {
		return 'EUR';
	}
}

function loadCounts(currencyCode) {
	try {
		const raw = localStorage.getItem(currencyStorageKey(STORAGE_COUNTS, currencyCode));
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object') return parsed;
	} catch {}
	return {};
}

function saveCounts() {
	try {
		localStorage.setItem(currencyStorageKey(STORAGE_COUNTS, currency), JSON.stringify(counts));
	} catch {}
}

function loadManualAdjustment(currencyCode) {
	try {
		const raw = localStorage.getItem(currencyStorageKey(STORAGE_MANUAL_ADJUSTMENT, currencyCode));
		if (raw === null) return 0;
		const saved = Number(raw);
		if (Number.isSafeInteger(saved)) return saved;
	} catch {}
	return 0;
}

function saveManualAdjustment() {
	try {
		localStorage.setItem(currencyStorageKey(STORAGE_MANUAL_ADJUSTMENT, currency), String(manualAdjustmentCents));
	} catch {}
}

function loadLocale() {
	try {
		const saved = localStorage.getItem(STORAGE_LOCALE);
		if (saved === 'en' || saved === 'es') return saved;
	} catch {}
	const nav = navigator.language || 'en';
	return nav.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function saveLocale() {
	try {
		localStorage.setItem(STORAGE_LOCALE, locale);
	} catch {}
}

function loadLayout() {
	try {
		const saved = localStorage.getItem(STORAGE_LAYOUT);
		if (saved === 'large' || saved === 'compact') return saved;
	} catch {}
	return 'compact';
}

function saveLayout() {
	try {
		localStorage.setItem(STORAGE_LAYOUT, layout);
	} catch {}
}

function loadTheme() {
	try {
		const saved = localStorage.getItem(STORAGE_THEME);
		if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
	} catch {}
	return 'system';
}

function saveTheme() {
	try {
		localStorage.setItem(STORAGE_THEME, theme);
	} catch {}
}

function loadPalette() {
	try {
		const saved = localStorage.getItem(STORAGE_PALETTE);
		if (saved === 'minimal' || saved === 'euro' || saved === 'market' || saved === 'coffee' || saved === 'fruitshop' || saved === 'butcher') return saved;
	} catch {}
	return 'minimal';
}

function savePalette() {
	try {
		localStorage.setItem(STORAGE_PALETTE, palette);
	} catch {}
}

function applyTheme() {
	if (theme === 'system') document.documentElement.removeAttribute('data-theme');
	else document.documentElement.setAttribute('data-theme', theme);
	syncRadioChoices(themeButtons, 'data-theme-choice', theme);
}

function applyPalette() {
	document.documentElement.setAttribute('data-palette', palette);
	syncRadioChoices(paletteButtons, 'data-palette-choice', palette);
	resizeTotalInput();
}

function syncRadioChoices(buttons, valueAttribute, selectedValue) {
	for (const button of buttons) {
		const selected = button.getAttribute(valueAttribute) === selectedValue;
		button.setAttribute('aria-checked', String(selected));
		button.tabIndex = selected ? 0 : -1;
		button.classList.toggle('is-selected', selected);
	}
}

function bindRadioChoices(buttons, valueAttribute, onSelect) {
	const options = Array.from(buttons);
	for (const [index, button] of options.entries()) {
		button.addEventListener('click', () => onSelect(button.getAttribute(valueAttribute)));
		button.addEventListener('keydown', (event) => {
			let nextIndex = index;
			if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % options.length;
			else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + options.length) % options.length;
			else if (event.key === 'Home') nextIndex = 0;
			else if (event.key === 'End') nextIndex = options.length - 1;
			else return;

			event.preventDefault();
			const nextButton = options[nextIndex];
			nextButton.focus();
			onSelect(nextButton.getAttribute(valueAttribute));
		});
	}
}

function t(key) {
	return i18n[locale][key] ?? key;
}

function template(str, label) {
	return str.replace('{{label}}', label);
}

function formatAmount(cents, currentLocale, currentCurrency) {
	const intlLocale = currentLocale === 'es' ? 'es-ES' : currentCurrency === 'USD' ? 'en-US' : 'de-DE';
	return new Intl.NumberFormat(intlLocale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
		useGrouping: false,
	}).format(cents / 100);
}

function parseManualAmount(input) {
	const value = input.trim().replace(/[\s€$]/g, '');
	if (!value) return null;

	const commaIndex = value.lastIndexOf(',');
	const dotIndex = value.lastIndexOf('.');
	let normalized = value;
	if (commaIndex >= 0 && dotIndex >= 0) {
		normalized = commaIndex > dotIndex
			? value.replace(/\./g, '').replace(',', '.')
			: value.replace(/,/g, '');
	} else {
		normalized = value.replace(',', '.');
	}
	if (normalized.startsWith('.')) normalized = `0${normalized}`;
	if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;

	const cents = Math.round(Number(normalized) * 100);
	return Number.isSafeInteger(cents) ? cents : null;
}

function applyLocale() {
	document.documentElement.lang = locale;
	document.title = t('pageTitle');
	for (const element of document.querySelectorAll('[data-i18n]')) {
		const key = element.getAttribute('data-i18n');
		if (!key || !(key in i18n[locale])) continue;
		element.textContent = t(key);
	}
	if (largeToggle) {
		largeToggle.checked = layout === 'large';
	}
	syncRadioChoices(localeButtons, 'data-locale-choice', locale);
	toolbar.querySelector('.settings-menu__trigger')?.setAttribute('aria-label', t('settings'));
	updateSettingsInstall();
	for (const row of root.querySelectorAll('[data-row]')) {
		const value = Number(row.getAttribute('data-value'));
		const key = row.getAttribute('data-key') ?? value.toFixed(2);
		const rowCurrency = row.getAttribute('data-currency');
		const kind = row.getAttribute('data-kind');
		const labelElement = row.querySelector('[data-denom-label]');
		const label = denominationLabel(value, kind, rowCurrency, key);
		if (labelElement) labelElement.textContent = label;
		row.querySelector('[data-count]')?.setAttribute(
			'aria-label',
			template(i18n[locale].countInputTemplate, label),
		);
		row.querySelector('[data-dec]')?.setAttribute('aria-label', template(i18n[locale].removeOneTemplate, label));
		row.querySelector('[data-inc]')?.setAttribute('aria-label', template(i18n[locale].addOneTemplate, label));
	}
	const currencyLabel = root.querySelector('[data-total-currency-label]');
	if (currencyLabel) currencyLabel.textContent = t(currency === 'EUR' ? 'totalAmountEuroLabel' : 'totalAmountDollarLabel');
	root.querySelector('[data-currency-switch]')?.setAttribute('aria-label', t('currencyLabel'));
	updateInstallCopy();
	syncDom();
}

function denominationLabel(value, kind, rowCurrency, key) {
	if (rowCurrency === 'EUR') return i18n[locale].denomLabels[key] ?? `${value} €`;
	if (value < 1) {
		const cents = Math.round(value * 100);
		return locale === 'es' ? `${cents} ${cents === 1 ? 'centavo' : 'centavos'}` : `${cents}¢`;
	}
	if (kind === 'coin') return locale === 'es' ? `$${value} moneda` : `$${value} coin`;
	return locale === 'es' ? `$${value} billete` : `$${value} bill`;
}

function applyLayout() {
	root.setAttribute('data-layout', layout);
	if (largeToggle) {
		largeToggle.checked = layout === 'large';
	}
	updateInstallBarOffset();
}

function computeDenominationTotalCents() {
	let totalCents = 0;
	for (const [key, count] of Object.entries(counts)) {
		const value = valueByKey.get(key);
		if (value === undefined || count <= 0) continue;
		totalCents += Math.round(value * 100) * count;
	}
	return Math.round(totalCents);
}

function computeTotalCents() {
	return Math.max(0, computeDenominationTotalCents() + manualAdjustmentCents);
}

function resizeTotalInput() {
	if (!totalEl || !totalMeasureContext) return;
	const currencyEl = totalDisplay?.querySelector('.counter__currency');
	const amountStyle = window.getComputedStyle(totalDisplay);
	const currencyStyle = currencyEl ? window.getComputedStyle(currencyEl) : null;
	const previousScale = Number.parseFloat(totalDisplay.style.getPropertyValue('--amount-scale')) || 1;
	const value = totalEl.value || '0';
	const baseFontSize = Number.parseFloat(amountStyle.fontSize);
	const letterSpacing = Number.parseFloat(amountStyle.letterSpacing) || 0;
	const currencyWidth = (currencyEl?.getBoundingClientRect().width ?? 0) / previousScale;
	const currencyGap = currencyStyle
		? (Number.parseFloat(currencyStyle.marginLeft) || 0) + (Number.parseFloat(currencyStyle.marginRight) || 0)
		: 0;
	const containerWidth = totalDisplay.parentElement?.clientWidth ?? totalDisplay.clientWidth;
	const baseCurrencyGap = currencyGap / previousScale;
	const separator = value.replace(/\d/g, '') || '.';
	const sizingValue = `${'8'.repeat(6)}${separator}88`;
	const measureAt = (fontSize, text) => {
		totalMeasureContext.font = `${amountStyle.fontWeight} ${fontSize}px ${amountStyle.fontFamily}`;
		const digitWidth = Math.max(...Array.from('0123456789', (digit) => totalMeasureContext.measureText(digit).width));
		const digitCount = text.match(/\d/g)?.length ?? 1;
		const separators = text.replace(/\d/g, '');
		return digitWidth * digitCount
			+ totalMeasureContext.measureText(separators).width
			+ letterSpacing * Math.max(0, text.length - 1);
	};
	const measuredWidth = measureAt(baseFontSize, sizingValue);
	const baseFieldWidth = measuredWidth + 4;
	const baseGroupWidth = baseFieldWidth + currencyWidth + baseCurrencyGap;
	const scale = Math.min(1, containerWidth / Math.max(1, baseGroupWidth));
	const fittedWidth = measuredWidth * scale;
	totalDisplay.style.setProperty('--amount-scale', String(scale));
	totalDisplay.style.setProperty('--amount-font-size', `${baseFontSize * scale}px`);
	totalEl.style.paddingRight = '0';
	totalEl.style.width = `${Math.max(24, Math.ceil(fittedWidth + 4 * scale))}px`;
}

function applyCurrency(nextCurrency, initialize = false) {
	if (nextCurrency !== 'EUR' && nextCurrency !== 'USD') return;
	if (nextCurrency === currency && !initialize) return;
	const isChangingCurrency = nextCurrency !== currency;
	const mappedCounts = isChangingCurrency ? mapCountsToCurrency(counts, currency, nextCurrency) : counts;
	currency = nextCurrency;
	try {
		localStorage.setItem(STORAGE_CURRENCY, currency);
	} catch {}
	counts = mappedCounts;
	if (isChangingCurrency) manualAdjustmentCents = 0;
	valueByKey = valueMap();
	saveCounts();
	saveManualAdjustment();
	root.setAttribute('data-currency', currency);
	for (const set of root.querySelectorAll('[data-currency-set]')) {
		set.hidden = set.getAttribute('data-currency-set') !== currency;
	}
	for (const button of currencyButtons) {
		const selected = button.getAttribute('data-currency-choice') === currency;
		button.classList.toggle('is-selected', selected);
		button.setAttribute('aria-pressed', String(selected));
	}
	const symbol = root.querySelector('[data-currency-symbol]');
	if (symbol) symbol.textContent = currency === 'EUR' ? '€' : '$';
	const currencyLabel = root.querySelector('[data-total-currency-label]');
	if (currencyLabel) currencyLabel.textContent = t(currency === 'EUR' ? 'totalAmountEuroLabel' : 'totalAmountDollarLabel');
	syncDom(false);
}

function renderTotal(cents) {
	if (!totalEl) return;
	totalEl.value = formatAmount(cents, locale, currency);
	resizeTotalInput();
}

function animateTotalIncrease(startCents, targetCents) {
	if (!totalEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		displayedTotalCents = targetCents;
		if (document.activeElement !== totalEl) renderTotal(targetCents);
		return;
	}
	if (totalAnimationFrame) cancelAnimationFrame(totalAnimationFrame);
	const isCentIncrease = targetCents - startCents <= 2;
	if (isCentIncrease) {
		displayedTotalCents = targetCents;
		renderTotal(targetCents);
		return;
	}
	const startedAt = performance.now();
	const duration = 600;
	const animateFrame = (now) => {
		const progress = Math.min((now - startedAt) / duration, 1);
		const eased = 1 - (1 - progress) ** 3;
		displayedTotalCents = Math.round(startCents + (targetCents - startCents) * eased);
		if (document.activeElement !== totalEl) renderTotal(displayedTotalCents);
		if (progress < 1) {
			totalAnimationFrame = requestAnimationFrame(animateFrame);
		} else {
			totalAnimationFrame = 0;
			displayedTotalCents = targetCents;
			renderTotal(targetCents);
		}
	};
	totalAnimationFrame = requestAnimationFrame(animateFrame);
}

function syncDom(animateIncrease = true) {
	for (const row of root.querySelectorAll('[data-row]')) {
		const value = Number(row.getAttribute('data-value'));
		const key = row.getAttribute('data-key') ?? value.toFixed(2);
		const countElement = row.querySelector('[data-count]');
		const count = counts[key] ?? 0;
		if (countElement && document.activeElement !== countElement) countElement.value = String(count);
		const decrementButton = row.querySelector('[data-dec]');
		if (decrementButton) decrementButton.disabled = count === 0;
		row.classList.toggle('row--active', count > 0);
	}
	const totalCents = computeTotalCents();
	const editingTotal = document.activeElement === totalEl;
	const currentDisplayCents = displayedTotalCents ?? lastTotalCents;
	if (animateIncrease && !editingTotal && currentDisplayCents !== null && totalCents > currentDisplayCents) {
		animateTotalIncrease(currentDisplayCents, totalCents);
	} else {
		if (totalAnimationFrame) cancelAnimationFrame(totalAnimationFrame);
		totalAnimationFrame = 0;
		displayedTotalCents = totalCents;
		if (editingTotal) resizeTotalInput();
		else renderTotal(totalCents);
	}
	lastTotalCents = totalCents;
}

function setCount(value, delta, key = value.toFixed(2)) {
	const next = Math.max(0, (counts[key] ?? 0) + delta);
	if (next === 0) delete counts[key];
	else counts[key] = next;
	saveCounts();
	syncDom();
}

function isStandalone() {
	return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosSafari() {
	const userAgent = navigator.userAgent;
	return /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
}

function installDismissed() {
	try {
		return localStorage.getItem(STORAGE_INSTALL_DISMISS) === '1';
	} catch {
		return false;
	}
}

function updateInstallCopy() {
	if (!installBody || !installBtn) return;
	if (deferredInstall) {
		installBody.textContent = t('installBody');
		installBtn.hidden = false;
	} else if (isIosSafari()) {
		installBody.textContent = t('installIosHint');
		installBtn.hidden = true;
	} else if (installHelp) {
		installBody.textContent = t('installFallback');
		installBtn.hidden = true;
	} else {
		installBody.textContent = '';
		installBtn.hidden = true;
	}
}

function updateInstallBarOffset() {
	if (installBar.hidden) {
		document.documentElement.style.setProperty('--install-bar-h', '0px');
		return;
	}
	const height = installBar.getBoundingClientRect().height;
	document.documentElement.style.setProperty('--install-bar-h', `${Math.ceil(height)}px`);
}

function showInstallBarIfNeeded() {
	const canInstall = Boolean(deferredInstall) || isIosSafari() || installHelp;
	installBar.hidden = isStandalone() || installDismissed() || !canInstall;
	updateInstallCopy();
	updateSettingsInstall();
	updateInstallBarOffset();
}

function updateSettingsInstall() {
	if (!settingsInstallWrap) return;
	settingsInstallWrap.hidden = isStandalone();
	if (settingsInstallWrap.hidden) return;
	if (settingsInstallHelp && settingsInstallHelpKey) {
		settingsInstallHelp.textContent = t(settingsInstallHelpKey);
		settingsInstallHelp.hidden = false;
		settingsInstallButton?.setAttribute('aria-expanded', 'true');
	} else {
		if (settingsInstallHelp) {
			settingsInstallHelp.textContent = '';
			settingsInstallHelp.hidden = true;
		}
		settingsInstallButton?.setAttribute('aria-expanded', 'false');
	}
}

async function promptInstall() {
	if (!deferredInstall) return;
	settingsInstallHelpKey = null;
	updateSettingsInstall();
	try {
		const promptEvent = deferredInstall;
		await promptEvent.prompt();
		const choice = await promptEvent.userChoice;
		deferredInstall = null;
		installHelp = choice.outcome !== 'accepted';
	} catch {
		deferredInstall = null;
		installHelp = true;
	}
	showInstallBarIfNeeded();
}

for (const row of root.querySelectorAll('[data-row]')) {
	const value = Number(row.getAttribute('data-value'));
	const key = row.getAttribute('data-key') ?? value.toFixed(2);
	row.querySelector('[data-inc]')?.addEventListener('click', () => setCount(value, 1, key));
	row.querySelector('[data-dec]')?.addEventListener('click', () => setCount(value, -1, key));
	const countInput = row.querySelector('[data-count]');
	countInput?.addEventListener('input', () => {
		if (countInput.value === '') return;
		const next = Number(countInput.value);
		if (!Number.isSafeInteger(next) || next < 0) return;
		if (next === 0) delete counts[key];
		else counts[key] = next;
		saveCounts();
		syncDom(false);
	});
	countInput?.addEventListener('blur', () => syncDom(false));
}

totalEl?.addEventListener('input', () => {
	const enteredCents = parseManualAmount(totalEl.value);
	if (enteredCents === null) return;
	manualAdjustmentCents = enteredCents - computeDenominationTotalCents();
	saveManualAdjustment();
	syncDom(false);
});

totalEl?.addEventListener('blur', () => syncDom(false));
totalEl?.addEventListener('focus', () => {
	if (!totalAnimationFrame) return;
	cancelAnimationFrame(totalAnimationFrame);
	totalAnimationFrame = 0;
	displayedTotalCents = computeTotalCents();
	renderTotal(displayedTotalCents);
});

resetBtn?.addEventListener('click', () => {
	counts = {};
	manualAdjustmentCents = 0;
	saveCounts();
	saveManualAdjustment();
	syncDom();
});

bindRadioChoices(localeButtons, 'data-locale-choice', (next) => {
	if (next !== 'en' && next !== 'es') return;
	locale = next;
	saveLocale();
	applyLocale();
});

for (const button of currencyButtons) {
	button.addEventListener('click', () => applyCurrency(button.getAttribute('data-currency-choice')));
}

largeToggle?.addEventListener('change', () => {
	layout = largeToggle.checked ? 'large' : 'compact';
	saveLayout();
	applyLayout();
});

bindRadioChoices(themeButtons, 'data-theme-choice', (next) => {
	if (next !== 'system' && next !== 'light' && next !== 'dark') return;
	theme = next;
	saveTheme();
	applyTheme();
});

function selectPalette(next) {
	if (next !== 'minimal' && next !== 'euro' && next !== 'market' && next !== 'coffee' && next !== 'fruitshop' && next !== 'butcher') return;
	palette = next;
	savePalette();
	applyPalette();
}

for (const [index, button] of Array.from(paletteButtons).entries()) {
	button.addEventListener('click', () => selectPalette(button.getAttribute('data-palette-choice')));
	button.addEventListener('keydown', (event) => {
		let nextIndex = index;
		if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % paletteButtons.length;
		else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + paletteButtons.length) % paletteButtons.length;
		else if (event.key === 'Home') nextIndex = 0;
		else if (event.key === 'End') nextIndex = paletteButtons.length - 1;
		else return;

		event.preventDefault();
		const nextButton = paletteButtons[nextIndex];
		nextButton.focus();
		selectPalette(nextButton.getAttribute('data-palette-choice'));
	});
}

window.addEventListener('beforeinstallprompt', (event) => {
	event.preventDefault();
	deferredInstall = event;
	installHelp = false;
	settingsInstallHelpKey = null;
	showInstallBarIfNeeded();
});

installBtn?.addEventListener('click', promptInstall);

settingsInstallButton?.addEventListener('click', () => {
	if (deferredInstall) {
		void promptInstall();
		return;
	}
	settingsInstallHelpKey = isIosSafari() ? 'installIosHint' : 'installFallback';
	updateSettingsInstall();
});

window.addEventListener('appinstalled', () => {
	deferredInstall = null;
	installHelp = false;
	settingsInstallHelpKey = null;
	showInstallBarIfNeeded();
});

installDismiss?.addEventListener('click', () => {
	try {
		localStorage.setItem(STORAGE_INSTALL_DISMISS, '1');
	} catch {}
	showInstallBarIfNeeded();
});

window.addEventListener('resize', () => {
	updateInstallBarOffset();
	resizeTotalInput();
});

applyTheme();
applyPalette();
applyLayout();
applyCurrency(currency, true);
applyLocale();
showInstallBarIfNeeded();
