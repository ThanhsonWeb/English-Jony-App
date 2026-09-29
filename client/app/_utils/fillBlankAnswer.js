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

const NUMBER_WORD_VALUES = {
	...SIMPLE_NUMBER_WORDS,
	twenty: 20,
	thirty: 30,
	forty: 40,
	fifty: 50,
	sixty: 60,
	seventy: 70,
	eighty: 80,
	ninety: 90,
};

const NUMBER_SCALES = {
	hundred: 100,
	thousand: 1_000,
	million: 1_000_000,
	billion: 1_000_000_000,
	trillion: 1_000_000_000_000,
};

const SMALL_NUMBER_WORDS = Object.keys(SIMPLE_NUMBER_WORDS);
const UNIT_NUMBER_WORDS = SMALL_NUMBER_WORDS.filter(
	(word) => SIMPLE_NUMBER_WORDS[word] < 10,
);
const TENS_NUMBER_WORDS = Object.keys(NUMBER_WORD_VALUES).filter(
	(word) => NUMBER_WORD_VALUES[word] >= 20,
);
const UNDER_HUNDRED_PATTERN =
	`(?:${SMALL_NUMBER_WORDS.join("|")}|` +
	`${TENS_NUMBER_WORDS.join("|")}(?:[- ]${UNIT_NUMBER_WORDS.join("|")})?)`;
const UNDER_THOUSAND_PATTERN =
	`(?:${UNIT_NUMBER_WORDS.join("|")} hundred(?: (?:and )?${UNDER_HUNDRED_PATTERN})?|` +
	`${UNDER_HUNDRED_PATTERN})`;
const NUMBER_PHRASE_PATTERN = new RegExp(
	`\\b${UNDER_THOUSAND_PATTERN}(?: (?:hundred|thousand|million|billion|trillion)(?: (?:and )?${UNDER_THOUSAND_PATTERN})?)*\\b`,
	"g",
);

export function normalizeAnswer(value) {
	return String(value ?? "")
		.toLocaleLowerCase()
		.replace(/(\d),(?=\d{3}(?:,|\b))/g, "$1")
		.replace(/[,.?!]/g, " ")
		.replace(/[’‘]/g, "'")
		.replace(/'/g, "")
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

function normalizeNumberWords(value) {
	return value.replace(NUMBER_PHRASE_PATTERN, (phrase) => {
		let total = 0;
		let current = 0;

		for (const word of phrase.split(/[ -]+/)) {
			if (word === "and") continue;

			if (Object.hasOwn(NUMBER_WORD_VALUES, word)) {
				current += NUMBER_WORD_VALUES[word];
			} else if (word === "hundred") {
				current = (current || 1) * NUMBER_SCALES.hundred;
			} else if (Object.hasOwn(NUMBER_SCALES, word)) {
				total += (current || 1) * NUMBER_SCALES[word];
				current = 0;
			}
		}

		return String(total + current);
	});
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
	if (
		normalizeNumberWords(normalizedValue) ===
		normalizeNumberWords(normalizedExpected)
	) {
		return true;
	}

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
