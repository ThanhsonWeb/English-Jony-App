const SIMPLE_NUMBER_WORDS = {
	zero: 0,
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
	eleven: 11,
	twelve: 12,
	thirteen: 13,
	fourteen: 14,
	fifteen: 15,
	sixteen: 16,
	seventeen: 17,
	eighteen: 18,
	nineteen: 19,
	twenty: 20,
};

export function normalizeAnswer(value) {
	return value
		.trim()
		.toLocaleLowerCase()
		.replace(/[’‘]/g, "'")
		.replace(/\s+/g, " ");
}

function getSimpleNumberValue(value) {
	if (Object.hasOwn(SIMPLE_NUMBER_WORDS, value)) {
		return String(SIMPLE_NUMBER_WORDS[value]);
	}

	if (/^\d+$/.test(value)) return String(Number(value));
	return null;
}

export function fillBlankAnswersMatch(value, expectedAnswer) {
	const normalizedValue = normalizeAnswer(value);
	const normalizedExpected = normalizeAnswer(expectedAnswer);
	const expectedNumber = getSimpleNumberValue(normalizedExpected);

	if (expectedNumber === null) return normalizedValue === normalizedExpected;
	return getSimpleNumberValue(normalizedValue) === expectedNumber;
}
