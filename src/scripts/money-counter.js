import { DENOMINATIONS_BY_CURRENCY } from '../lib/denominations';
import { toClientStrings } from '../i18n/messages';

const STORAGE_COUNTS = 'money-counter-counts-v1';
const STORAGE_LOCALE = 'money-counter-locale-v1';
const STORAGE_LAYOUT = 'money-counter-layout-v1';
const STORAGE_THEME = 'money-counter-theme-v1';
const STORAGE_PALETTE = 'money-counter-palette-v1';
const STORAGE_CURRENCY = 'money-counter-currency-v1';
const STORAGE_BREAKDOWN = 'money-counter-breakdown-v1';
const STORAGE_INSTALL_DISMISS = 'money-counter-install-dismiss-v1';
const STORAGE_SAVED_ACCOUNTS = 'money-counter-saved-accounts-v1';

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
const breakdownToggle = toolbar.querySelector('[data-breakdown-toggle]');
const breakdown = root.querySelector('[data-breakdown]');
const customizeDialog = toolbar.querySelector('[data-customize-dialog]');
const accountsDialog = toolbar.querySelector('[data-accounts-dialog]');
const accountsList = toolbar.querySelector('[data-accounts-list]');
const accountsEmpty = toolbar.querySelector('[data-accounts-empty]');
const accountsStatus = toolbar.querySelector('[data-account-status]');
const accountNameInput = toolbar.querySelector('[data-account-name]');
const localeButtons = toolbar.querySelectorAll('[data-locale-choice]');
const themeButtons = toolbar.querySelectorAll('[data-theme-choice]');
const paletteButtons = toolbar.querySelectorAll('[data-palette-choice]');
const currencyButtons = root?.querySelectorAll('[data-currency-choice]') ?? [];

let currency = loadCurrency();
let counts = loadCounts(currency);
let locale = loadLocale();
let layout = loadLayout();
let theme = loadTheme();
let palette = loadPalette();
let showBreakdown = loadBreakdown();
let savedAccounts = loadSavedAccounts();
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

function loadSavedAccounts() {
	try {
		const parsed = JSON.parse(localStorage.getItem(STORAGE_SAVED_ACCOUNTS) || '[]');
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((account) => account && typeof account.id === 'string'
			&& typeof account.name === 'string' && (account.currency === 'EUR' || account.currency === 'USD')
			&& account.counts && typeof account.counts === 'object').map((account) => {
				const allowed = new Set(activeDenominations(account.currency).map((denomination) => account.currency === 'EUR' ? denomination.value.toFixed(2) : denomination.id));
				const safeCounts = {};
				for (const [key, count] of Object.entries(account.counts)) {
					if (allowed.has(key) && Number.isSafeInteger(count) && count > 0) safeCounts[key] = count;
				}
				return { id: account.id, name: account.name.slice(0, 48), currency: account.currency, counts: safeCounts, createdAt: typeof account.createdAt === 'string' ? account.createdAt : '' };
			});
	} catch { return []; }
}

function persistSavedAccounts() {
	try { localStorage.setItem(STORAGE_SAVED_ACCOUNTS, JSON.stringify(savedAccounts)); } catch {}
}

function renderSavedAccounts() {
	if (!(accountsList instanceof HTMLUListElement)) return;
	accountsList.replaceChildren();
	if (accountsEmpty) accountsEmpty.hidden = savedAccounts.length > 0;
	for (const account of savedAccounts) {
		const item = document.createElement('li');
		item.className = 'accounts-list__item';
		const info = document.createElement('div');
		info.className = 'accounts-list__info';
		const name = document.createElement('strong');
		name.className = 'accounts-list__name';
		name.textContent = account.name;
		const valueCents = activeDenominations(account.currency).reduce((sum, denomination) => {
			const key = account.currency === 'EUR' ? denomination.value.toFixed(2) : denomination.id;
			const count = account.counts[key] || 0;
			return sum + Math.round(denomination.value * 100) * count;
		}, 0);
		const summary = document.createElement('span');
		summary.className = 'accounts-list__summary';
		summary.textContent = `${formatAmount(valueCents, locale, account.currency)} ${account.currency}`;
		if (account.createdAt) {
			const date = new Date(account.createdAt);
			if (!Number.isNaN(date.valueOf())) summary.textContent += ` · ${new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'medium' }).format(date)}`;
		}
		info.append(name, summary);
		const actions = document.createElement('div');
		actions.className = 'accounts-list__actions';
		for (const [action, key] of [['load', 'loadAccount'], ['rename', 'renameAccount'], ['delete', 'deleteAccount']]) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = `accounts-list__action${action === 'delete' ? ' accounts-list__action--delete' : ''}`;
			button.textContent = t(key);
			button.setAttribute('aria-label', `${t(key)}: ${account.name}`);
			button.addEventListener('click', () => {
				if (action === 'load') {
					if (currency !== account.currency) applyCurrency(account.currency);
					counts = { ...account.counts };
					valueByKey = valueMap();
					saveCounts();
					syncDom(false);
					if (accountsStatus) accountsStatus.textContent = t('accountLoaded');
					accountsDialog?.close();
				} else if (action === 'rename') {
					info.hidden = true;
					actions.hidden = true;
					const form = document.createElement('form');
					form.className = 'accounts-rename';
					const input = document.createElement('input');
					input.type = 'text';
					input.value = account.name;
					input.maxLength = 48;
					input.required = true;
					input.setAttribute('aria-label', t('accountNameLabel'));
					const save = document.createElement('button');
					save.type = 'submit';
					save.className = 'accounts-list__action';
					save.textContent = t('accountRenameSave');
					const cancel = document.createElement('button');
					cancel.type = 'button';
					cancel.className = 'accounts-list__action';
					cancel.textContent = t('accountRenameCancel');
					cancel.addEventListener('click', renderSavedAccounts);
					form.append(input, save, cancel);
					form.addEventListener('submit', (submitEvent) => {
						submitEvent.preventDefault();
						const nextName = input.value.trim();
						if (!nextName) { input.focus(); return; }
						account.name = nextName.slice(0, 48);
						persistSavedAccounts();
						renderSavedAccounts();
					});
					item.insertBefore(form, actions);
					input.focus();
				} else if (window.confirm(t('confirmDeleteAccount'))) {
					savedAccounts = savedAccounts.filter((saved) => saved.id !== account.id);
					persistSavedAccounts();
					renderSavedAccounts();
					if (accountsStatus) accountsStatus.textContent = t('accountDeleted');
				}
			});
			actions.append(button);
		}
		item.append(info, actions);
		accountsList.append(item);
	}
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
		if (saved === 'minimal' || saved === 'swiss' || saved === 'neo' || saved === 'market' || saved === 'coffee' || saved === 'fruitshop' || saved === 'butcher') return saved;
	} catch {}
	return 'minimal';
}

function savePalette() {
	try {
		localStorage.setItem(STORAGE_PALETTE, palette);
	} catch {}
}

function loadBreakdown() {
	try {
		return localStorage.getItem(STORAGE_BREAKDOWN) === 'true';
	} catch {}
	return false;
}

function applyBreakdown() {
	if (breakdownToggle) breakdownToggle.checked = showBreakdown;
	if (breakdown) breakdown.hidden = !showBreakdown;
}

function applyTheme() {
	if (theme === 'system') document.documentElement.removeAttribute('data-theme');
	else document.documentElement.setAttribute('data-theme', theme);
	syncRadioChoices(themeButtons, 'data-theme-choice', theme);
}

function applyPalette() {
	document.documentElement.setAttribute('data-palette', palette);
	syncRadioChoices(paletteButtons, 'data-palette-choice', palette);
	resizeTotalDisplay();
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
	toolbar.querySelector('[data-customize-close]')?.setAttribute('aria-label', t('close'));
	toolbar.querySelector('[data-accounts-close]')?.setAttribute('aria-label', t('close'));
	if (accountNameInput) accountNameInput.setAttribute('placeholder', t('accountNamePlaceholder'));
	renderSavedAccounts();
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
		row.querySelector('[data-add-menu]')?.setAttribute('aria-label', t('quickAdd'));
		for (const option of row.querySelectorAll('[data-batch-add]')) {
			option.setAttribute('aria-label', t(option.getAttribute('data-batch-add') === '5' ? 'addFive' : 'addTen'));
		}
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
	return computeDenominationTotalCents();
}

function resizeTotalDisplay() {
	if (!totalEl || !totalMeasureContext) return;
	const currencyEl = totalDisplay?.querySelector('.counter__currency');
	const amountStyle = window.getComputedStyle(totalDisplay);
	const currencyStyle = currencyEl ? window.getComputedStyle(currencyEl) : null;
	const previousScale = Number.parseFloat(totalDisplay.style.getPropertyValue('--amount-scale')) || 1;
	const value = totalEl.textContent || '0';
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
	valueByKey = valueMap();
	saveCounts();
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
	totalEl.textContent = formatAmount(cents, locale, currency);
	resizeTotalDisplay();
}

function animateTotalIncrease(startCents, targetCents) {
	if (!totalEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		displayedTotalCents = targetCents;
		renderTotal(targetCents);
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
		renderTotal(displayedTotalCents);
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
	if (breakdown) {
		for (const kind of ['coin', 'note']) {
			let subtotalCents = 0;
			for (const denomination of activeDenominations()) {
				if (denomination.kind !== kind) continue;
				const key = currency === 'EUR' ? denomination.value.toFixed(2) : denomination.id;
				subtotalCents += Math.round(denomination.value * 100) * (counts[key] ?? 0);
			}
			const output = breakdown.querySelector(`[data-breakdown-total="${kind}"]`);
			if (output) output.textContent = formatAmount(subtotalCents, locale, currency);
		}
	}
	const totalCents = computeTotalCents();
	if (resetBtn) resetBtn.disabled = totalCents === 0;
	const currentDisplayCents = displayedTotalCents ?? lastTotalCents;
	if (animateIncrease && currentDisplayCents !== null && totalCents > currentDisplayCents) {
		animateTotalIncrease(currentDisplayCents, totalCents);
	} else {
		if (totalAnimationFrame) cancelAnimationFrame(totalAnimationFrame);
		totalAnimationFrame = 0;
		displayedTotalCents = totalCents;
		renderTotal(totalCents);
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

function closeQuickAddMenus(restoreFocus = false) {
	const openRows = Array.from(root.querySelectorAll('.row--quick-add-open'));
	for (const row of openRows) {
		row.classList.remove('row--quick-add-open');
		const trigger = row.querySelector('[data-inc]');
		trigger?.setAttribute('aria-expanded', 'false');
		if (trigger) trigger.dataset.longPressOpened = 'false';
		const menu = row.querySelector('[data-add-menu]');
		if (menu) menu.hidden = true;
	}
	if (restoreFocus) openRows[0]?.querySelector('[data-inc]')?.focus();
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
	const addButton = row.querySelector('[data-inc]');
	const addMenu = row.querySelector('[data-add-menu]');
	let holdTimer = 0;
	const clearHoldTimer = () => {
		if (holdTimer) window.clearTimeout(holdTimer);
		holdTimer = 0;
	};
	const openAddMenu = () => {
		closeQuickAddMenus();
		if (!addMenu || !addButton) return;
		addMenu.hidden = false;
		addButton.setAttribute('aria-expanded', 'true');
		addButton.dataset.longPressOpened = 'true';
		row.classList.add('row--quick-add-open');
		addMenu.querySelector('button')?.focus();
	};
	addButton?.addEventListener('pointerdown', (event) => {
		if (!event.isPrimary || event.button !== 0) return;
		clearHoldTimer();
		holdTimer = window.setTimeout(openAddMenu, 500);
	});
	for (const eventName of ['pointerup', 'pointerleave', 'pointercancel']) {
		addButton?.addEventListener(eventName, clearHoldTimer);
	}
	addButton?.addEventListener('contextmenu', (event) => {
		event.preventDefault();
		openAddMenu();
	});
	addButton?.addEventListener('keydown', (event) => {
		if (event.key !== 'ArrowDown') return;
		event.preventDefault();
		openAddMenu();
	});
	addButton?.addEventListener('click', (event) => {
		if (addButton.dataset.longPressOpened === 'true') {
			event.preventDefault();
			return;
		}
		setCount(value, 1, key);
	});
	for (const option of row.querySelectorAll('[data-batch-add]')) {
		option.addEventListener('click', () => {
			const amount = Number(option.getAttribute('data-batch-add'));
			closeQuickAddMenus();
			setCount(value, amount, key);
			addButton?.focus();
		});
	}
	addMenu?.addEventListener('keydown', (event) => {
		const options = Array.from(addMenu.querySelectorAll('[data-batch-add]'));
		const currentIndex = options.indexOf(document.activeElement);
		if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
			event.preventDefault();
			options[(currentIndex + 1) % options.length]?.focus();
		} else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
			event.preventDefault();
			options[(currentIndex - 1 + options.length) % options.length]?.focus();
		} else if (event.key === 'Home') {
			event.preventDefault();
			options[0]?.focus();
		} else if (event.key === 'End') {
			event.preventDefault();
			options.at(-1)?.focus();
		}
	});
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

document.addEventListener('pointerdown', (event) => {
	if (!(event.target instanceof Element)) return;
	const openRow = event.target.closest('.row--quick-add-open');
	if (!openRow || !event.target.closest('[data-add-menu]')) closeQuickAddMenus();
});
document.addEventListener('focusin', (event) => {
	if (!(event.target instanceof Element)) return;
	const openRow = root.querySelector('.row--quick-add-open');
	if (openRow && !openRow.contains(event.target)) closeQuickAddMenus();
});
document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && root.querySelector('.row--quick-add-open')) {
		event.preventDefault();
		closeQuickAddMenus(true);
	}
});

resetBtn?.addEventListener('click', () => {
	counts = {};
	saveCounts();
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

breakdownToggle?.addEventListener('change', () => {
	showBreakdown = breakdownToggle.checked;
	try {
		localStorage.setItem(STORAGE_BREAKDOWN, String(showBreakdown));
	} catch {}
	applyBreakdown();
	syncDom(false);
});

toolbar.querySelector('[data-customize-open]')?.addEventListener('click', () => {
	if (customizeDialog instanceof HTMLDialogElement) customizeDialog.showModal();
});
toolbar.querySelector('[data-customize-close]')?.addEventListener('click', () => customizeDialog?.close());
customizeDialog?.addEventListener('click', (event) => {
	if (event.target === customizeDialog) customizeDialog.close();
});
toolbar.querySelector('[data-accounts-open]')?.addEventListener('click', () => {
	if (accountsStatus) accountsStatus.textContent = '';
	renderSavedAccounts();
	if (accountsDialog instanceof HTMLDialogElement) accountsDialog.showModal();
});
toolbar.querySelector('[data-accounts-close]')?.addEventListener('click', () => accountsDialog?.close());
accountsDialog?.addEventListener('click', (event) => {
	if (event.target === accountsDialog) accountsDialog.close();
});
toolbar.querySelector('[data-account-save-form]')?.addEventListener('submit', (event) => {
	event.preventDefault();
	const typedName = accountNameInput instanceof HTMLInputElement ? accountNameInput.value.trim() : '';
	const nextNumber = savedAccounts.length + 1;
	const name = typedName || t('accountDefaultName').replace('{{number}}', String(nextNumber));
	savedAccounts.unshift({
		id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		name: name.slice(0, 48),
		currency,
		counts: { ...counts },
		createdAt: new Date().toISOString(),
	});
	persistSavedAccounts();
	if (accountNameInput instanceof HTMLInputElement) accountNameInput.value = '';
	if (accountsStatus) accountsStatus.textContent = t('accountSaved');
	renderSavedAccounts();
});

bindRadioChoices(themeButtons, 'data-theme-choice', (next) => {
	if (next !== 'system' && next !== 'light' && next !== 'dark') return;
	theme = next;
	saveTheme();
	applyTheme();
});

function selectPalette(next) {
	if (next !== 'minimal' && next !== 'swiss' && next !== 'neo' && next !== 'market' && next !== 'coffee' && next !== 'fruitshop' && next !== 'butcher') return;
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
	resizeTotalDisplay();
});

applyTheme();
applyPalette();
applyLayout();
applyBreakdown();
applyCurrency(currency, true);
applyLocale();
showInstallBarIfNeeded();
