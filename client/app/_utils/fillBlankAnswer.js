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
	return String(value ?? "")
		.toLocaleLowerCase()
		.replace(/[,.?!]/g, " ")
		.replace(/[’‘]/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}

function getSimpleNumberValue(value) {
	if (Object.hasOwn(SIMPLE_NUMBER_WORDS, value)) {
		return String(SIMPLE_NUMBER_WORDS[value]);
	}

	if (/^\d+$/.test(value)) return String(Number(value));
	return null;
}

function isShortHyphenatedWord(value) {
	return (
		/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+$/u.test(value) &&
		value.replace(/-/g, "").length <= 24
	);
}

function getCompactWord(value) {
	if (!/^[\p{L}\p{N}]+(?:[- ]+[\p{L}\p{N}]+)*$/u.test(value)) {
		return null;
	}

	const compactValue = value.replace(/[- ]/g, "");
	return compactValue.length <= 24 ? compactValue : null;
}

export function fillBlankAnswersMatch(value, expectedAnswer) {
	const normalizedValue = normalizeAnswer(value);
	const normalizedExpected = normalizeAnswer(expectedAnswer);
	const expectedNumber = getSimpleNumberValue(normalizedExpected);

	if (normalizedValue === normalizedExpected) return true;
	if (expectedNumber !== null) {
		return getSimpleNumberValue(normalizedValue) === expectedNumber;
	}

	if (
		!isShortHyphenatedWord(normalizedValue) &&
		!isShortHyphenatedWord(normalizedExpected)
	) {
		return false;
	}

	const compactValue = getCompactWord(normalizedValue);
	const compactExpected = getCompactWord(normalizedExpected);
	return compactValue !== null && compactValue === compactExpected;
}
