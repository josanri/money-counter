/** Approximate real-world euro coin and note colors (accent dots only). */
export const MONEY_ACCENT: Record<string, string> = {
	'0.01': '#c97f4a',
	'0.02': '#c97f4a',
	'0.05': '#c97f4a',
	'0.10': '#e3c566',
	'0.20': '#e3c566',
	'0.50': '#e3c566',
	'1.00': '#d4af37',
	'2.00': '#c9a227',
	'5.00': '#9a9a9a',
	'10.00': '#c45c5c',
	'20.00': '#4a6fa5',
	'50.00': '#c7863a',
	'100.00': '#5a9a6e',
	'200.00': '#c9a0c9',
	'500.00': '#9a9a6a',
};

export function accentForValue(value: number): string {
	return MONEY_ACCENT[value.toFixed(2)] ?? '#888888';
}
