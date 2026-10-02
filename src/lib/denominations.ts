export type DenominationKind = 'coin' | 'note';

export interface Denomination {
	/** Value in the currency's major unit */
	value: number;
	label: string;
	kind: DenominationKind;
	id: string;
	/** Hidden from the counter UI */
	hidden?: boolean;
}

function makeDenomination(value: number, kind: DenominationKind, label: string): Denomination {
	return { value, kind, label, id: `${kind}-${value.toFixed(2)}` };
}

export const DENOMINATIONS_BY_CURRENCY = {
	EUR: [
		makeDenomination(0.01, 'coin', '1 ct'),
		makeDenomination(0.02, 'coin', '2 ct'),
		makeDenomination(0.05, 'coin', '5 ct'),
		makeDenomination(0.1, 'coin', '10 ct'),
		makeDenomination(0.2, 'coin', '20 ct'),
		makeDenomination(0.5, 'coin', '50 ct'),
		makeDenomination(1, 'coin', '1 €'),
		makeDenomination(2, 'coin', '2 €'),
		makeDenomination(5, 'note', '5 €'),
		makeDenomination(10, 'note', '10 €'),
		makeDenomination(20, 'note', '20 €'),
		makeDenomination(50, 'note', '50 €'),
		makeDenomination(100, 'note', '100 €'),
		makeDenomination(200, 'note', '200 €'),
		makeDenomination(500, 'note', '500 €'),
	] as const,
	USD: [
		makeDenomination(0.01, 'coin', '1¢'),
		makeDenomination(0.05, 'coin', '5¢'),
		makeDenomination(0.1, 'coin', '10¢'),
		makeDenomination(0.25, 'coin', '25¢'),
		makeDenomination(0.5, 'coin', '50¢'),
		makeDenomination(1, 'coin', '$1 coin'),
		makeDenomination(1, 'note', '$1'),
		makeDenomination(2, 'note', '$2'),
		makeDenomination(5, 'note', '$5'),
		makeDenomination(10, 'note', '$10'),
		makeDenomination(20, 'note', '$20'),
		makeDenomination(50, 'note', '$50'),
		makeDenomination(100, 'note', '$100'),
	] as const,
} as const satisfies Record<'EUR' | 'USD', readonly Denomination[]>;

export type CurrencyCode = keyof typeof DENOMINATIONS_BY_CURRENCY;

export const VISIBLE_DENOMINATIONS = DENOMINATIONS_BY_CURRENCY.EUR;

export function denominationKey(value: number): string {
	return value.toFixed(2);
}
