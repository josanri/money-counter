export type Locale = 'en' | 'es';

export type Messages = {
	langLabel: string;
	languageEnglish: string;
	languageSpanish: string;
	settings: string;
	localeName: string;
	total: string;
	totalAmountLabel: string;
	totalAmountEuroLabel: string;
	totalAmountDollarLabel: string;
	currencyLabel: string;
	clearAll: string;
	coins: string;
	notes: string;
	largeControls: string;
	largeControlsHint: string;
	customize: string;
	customizeTitle: string;
	customizeDescription: string;
	savedAccountsMenu: string;
	savedAccountsTitle: string;
	savedAccountsDescription: string;
	accountNameLabel: string;
	accountNamePlaceholder: string;
	saveAccount: string;
	noSavedAccounts: string;
	loadAccount: string;
	renameAccount: string;
	deleteAccount: string;
	accountDefaultName: string;
	accountSaved: string;
	accountLoaded: string;
	accountDeleted: string;
	confirmDeleteAccount: string;
	accountNamePrompt: string;
	accountRenameSave: string;
	accountRenameCancel: string;
	showBreakdown: string;
	showBreakdownHint: string;
	close: string;
	paletteLabel: string;
	paletteMinimal: string;
	paletteSwiss: string;
	paletteNeo: string;
	paletteMarket: string;
	paletteCoffeeShop: string;
	paletteFruitshop: string;
	paletteButcher: string;
	themeLabel: string;
	themeAuto: string;
	themeLight: string;
	themeDark: string;
	installTitle: string;
	installBody: string;
	installFallback: string;
	installAction: string;
	installIosHint: string;
	installDismiss: string;
	pageTitle: string;
	pageDescription: string;
	denomLabel: (value: number) => string;
	removeOneTemplate: string;
	addOneTemplate: string;
	countInputTemplate: string;
	quickAdd: string;
	addFive: string;
	addTen: string;
};

export type ClientLocaleStrings = Omit<Messages, 'denomLabel'> & {
	denomLabels: Record<string, string>;
};

export function toClientStrings(locale: Locale): ClientLocaleStrings {
	const { denomLabel, ...rest } = MESSAGES[locale];
	const denomLabels: Record<string, string> = {};
	const values = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
	for (const v of values) denomLabels[v.toFixed(2)] = denomLabel(v);
	return { ...rest, denomLabels };
}

const en: Messages = {
	langLabel: 'Language',
	languageEnglish: 'English',
	languageSpanish: 'Spanish',
	settings: 'Settings',
	localeName: 'English',
	total: 'Total',
	totalAmountLabel: 'Total amount in euros',
	totalAmountEuroLabel: 'Total amount in euros',
	totalAmountDollarLabel: 'Total amount in US dollars',
	currencyLabel: 'Currency',
	clearAll: 'Clear all',
	coins: 'Coins',
	notes: 'Notes',
	largeControls: 'Large buttons',
	largeControlsHint: 'Make denomination controls easier to tap.',
	customize: 'Customize',
	customizeTitle: 'Customize counter',
	customizeDescription: 'Choose the controls and summary details that work for you.',
	savedAccountsMenu: 'Saved accounts',
	savedAccountsTitle: 'Saved accounts',
	savedAccountsDescription: 'Save this count and return to it later.',
	accountNameLabel: 'Account name',
	accountNamePlaceholder: 'For example, Friday market',
	saveAccount: 'Save current',
	noSavedAccounts: 'No saved accounts yet.',
	loadAccount: 'Load',
	renameAccount: 'Rename',
	deleteAccount: 'Delete',
	accountDefaultName: 'Account {{number}}',
	accountSaved: 'Account saved.',
	accountLoaded: 'Account loaded.',
	accountDeleted: 'Account deleted.',
	confirmDeleteAccount: 'Delete this saved account?',
	accountNamePrompt: 'Enter a new name for this account',
	accountRenameSave: 'Save name',
	accountRenameCancel: 'Cancel',
	showBreakdown: 'Show coin and note subtotals',
	showBreakdownHint: 'Add a separate total for coins and bills.',
	close: 'Close',
	paletteLabel: 'Color theme',
	paletteMinimal: 'Minimal',
	paletteSwiss: 'Swiss Minimalist',
	paletteNeo: 'Neo Brutalism',
	paletteMarket: 'Market',
	paletteCoffeeShop: 'Coffee Shop',
	paletteFruitshop: 'Fruit Shop',
	paletteButcher: 'Butcher',
	themeLabel: 'Appearance',
	themeAuto: 'Auto',
	themeLight: 'Light',
	themeDark: 'Dark',
	installTitle: 'Install app',
	installBody: 'Add to your home screen for quick access.',
	installFallback: 'Use your browser menu and choose Install app or Add to Home Screen.',
	installAction: 'Install',
	installIosHint: 'Safari: Share → Add to Home Screen',
	installDismiss: 'Dismiss',
	pageTitle: 'Money Counter',
	pageDescription: 'Count euro and US dollar coins and notes. Minimal, fast, installable.',
	denomLabel: (value) => {
		if (value < 1) return `${Math.round(value * 100)} ct`;
		return `${value} €`;
	},
	removeOneTemplate: 'Remove one {{label}}',
	addOneTemplate: 'Add one {{label}}',
	countInputTemplate: 'Number of {{label}}',
	quickAdd: 'Add more',
	addFive: 'Add five',
	addTen: 'Add ten',
};

const es: Messages = {
	langLabel: 'Idioma',
	languageEnglish: 'Inglés',
	languageSpanish: 'Español',
	settings: 'Ajustes',
	localeName: 'Español',
	total: 'Total',
	totalAmountLabel: 'Importe total en euros',
	totalAmountEuroLabel: 'Importe total en euros',
	totalAmountDollarLabel: 'Importe total en dólares estadounidenses',
	currencyLabel: 'Moneda',
	clearAll: 'Borrar todo',
	coins: 'Monedas',
	notes: 'Billetes',
	largeControls: 'Botones grandes',
	largeControlsHint: 'Haz que los controles sean más fáciles de pulsar.',
	customize: 'Personalizar',
	customizeTitle: 'Personalizar contador',
	customizeDescription: 'Elige los controles y los detalles del resumen.',
	savedAccountsMenu: 'Cuentas guardadas',
	savedAccountsTitle: 'Cuentas guardadas',
	savedAccountsDescription: 'Guarda esta cuenta y vuelve a ella más tarde.',
	accountNameLabel: 'Nombre de la cuenta',
	accountNamePlaceholder: 'Por ejemplo, mercado del viernes',
	saveAccount: 'Guardar actual',
	noSavedAccounts: 'Todavía no hay cuentas guardadas.',
	loadAccount: 'Cargar',
	renameAccount: 'Renombrar',
	deleteAccount: 'Borrar',
	accountDefaultName: 'Cuenta {{number}}',
	accountSaved: 'Cuenta guardada.',
	accountLoaded: 'Cuenta cargada.',
	accountDeleted: 'Cuenta borrada.',
	confirmDeleteAccount: '¿Borrar esta cuenta guardada?',
	accountNamePrompt: 'Escribe un nombre nuevo para esta cuenta',
	accountRenameSave: 'Guardar nombre',
	accountRenameCancel: 'Cancelar',
	showBreakdown: 'Mostrar subtotales de monedas y billetes',
	showBreakdownHint: 'Añade un total separado para monedas y billetes.',
	close: 'Cerrar',
	paletteLabel: 'Tema de color',
	paletteMinimal: 'Minimalista',
	paletteSwiss: 'Minimalismo suizo',
	paletteNeo: 'Neobrutalismo',
	paletteMarket: 'Mercado',
	paletteCoffeeShop: 'Cafetería',
	paletteFruitshop: 'Frutería',
	paletteButcher: 'Carnicería',
	themeLabel: 'Apariencia',
	themeAuto: 'Auto',
	themeLight: 'Claro',
	themeDark: 'Oscuro',
	installTitle: 'Instalar app',
	installBody: 'Añádela a la pantalla de inicio para acceder rápido.',
	installFallback: 'Abre el menú del navegador y elige Instalar app o Añadir a pantalla de inicio.',
	installAction: 'Instalar',
	installIosHint: 'Safari: Compartir → Añadir a inicio',
	installDismiss: 'Cerrar',
	pageTitle: 'Contador de dinero',
	pageDescription: 'Cuenta monedas y billetes en euros y dólares estadounidenses. Minimalista e instalable.',
	denomLabel: (value) => {
		if (value < 1) return `${Math.round(value * 100)} cts`;
		return `${value} €`;
	},
	removeOneTemplate: 'Quitar una {{label}}',
	addOneTemplate: 'Añadir una {{label}}',
	countInputTemplate: 'Cantidad de {{label}}',
	quickAdd: 'Añadir más',
	addFive: 'Añadir cinco',
	addTen: 'Añadir diez',
};

export const MESSAGES: Record<Locale, Messages> = { en, es };

export function resolveLocale(input: string | null | undefined): Locale {
	if (input === 'es' || input === 'en') return input;
	if (input?.toLowerCase().startsWith('es')) return 'es';
	return 'en';
}

export function formatEuro(amount: number, locale: Locale): string {
	const intl = locale === 'es' ? 'es-ES' : 'de-DE';
	return new Intl.NumberFormat(intl, {
		style: 'currency',
		currency: 'EUR',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}
