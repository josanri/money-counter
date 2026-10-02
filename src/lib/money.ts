const eurFormatter = new Intl.NumberFormat('de-DE', {
	style: 'currency',
	currency: 'EUR',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export function formatEuro(amount: number): string {
	return eurFormatter.format(amount);
}

export function totalFromCounts(
	counts: Record<string, number>,
	valueByKey: Map<string, number>,
): number {
	let total = 0;
	for (const [key, count] of Object.entries(counts)) {
		const value = valueByKey.get(key);
		if (value === undefined || count <= 0) continue;
		total += value * count;
	}
	return Math.round(total * 100) / 100;
}
