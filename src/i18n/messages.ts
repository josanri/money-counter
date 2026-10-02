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
	paletteLabel: string;
	paletteMinimal: string;
	paletteEuro: string;
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
	paletteLabel: 'Color theme',
	paletteMinimal: 'Minimal',
	paletteEuro: 'Euro',
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
	paletteLabel: 'Tema de color',
	paletteMinimal: 'Minimalista',
	paletteEuro: 'Euro',
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
