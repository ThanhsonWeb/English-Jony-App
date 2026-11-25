const CEFR_LEVELS = new Set(["a1", "a2", "b1", "b2", "c1", "c2"]);
const EXPECTED_LEVELS = "A1, A2, B1, B2, C1, or C2";

// Active A1 lesson identities must remain protected even if their files or config change.
const PROTECTED_A1 = {
	"asking-for-directions": ["finding-the-bus-stop", "finding-a-cafe", "finding-the-train-station", "going-to-the-supermarket"],
	"coffee-shop": ["ordering-a-coffee", "choosing-a-snack", "asking-about-the-wifi", "fixing-an-order"],
	"grocery-store": ["making-a-shopping-list", "finding-items", "choosing-food", "checking-out"],
	"restaurant": ["getting-a-table", "reading-the-menu", "ordering-food", "during-the-meal"],
	"walk-in-the-park": ["meeting-at-the-park", "talking-about-work", "talking-about-themselves", "weekend-plans"],
	"ten-minutes-a-day": ["the-old-book", "only-ten-minutes", "the-presentation", "the-real-treasure"],
	"grateful": ["a-busy-morning", "a-small-act-of-kindness", "saying-thank-you", "helping-in-return"],
	"a-small-surprise": ["a-special-day", "a-secret-plan", "the-broken-cake", "the-best-gift"],
	"naruto-season-1": ["the-lonely-boy", "the-ninja-test", "the-forbidden-scroll", "someone-believes-in-him", "a-new-friend", "team-seven", "meet-kakashi", "the-bell-test", "working-together", "a-real-team"],
	"a-little-lie": ["the-broken-window", "a-little-lie", "the-heavy-feeling", "telling-the-truth"],
	"conan-season-1": ["the-roller-coaster", "the-men-in-black", "a-small-body", "a-boy-named-conan"],
};

function normalizeCefrLevel(level, label) {
	if (typeof level !== "string" || !level.trim()) {
		throw new Error(`${label} is missing; expected ${EXPECTED_LEVELS}.`);
	}

	const normalized = level.trim().toLowerCase();
	const canonical = normalized === "beginner" ? "a1" : normalized;
	if (!CEFR_LEVELS.has(canonical)) {
		throw new Error(
			`${label} "${level}" is invalid; expected ${EXPECTED_LEVELS}.`,
		);
	}

	return canonical;
}

export function assertNoRegisteredA1Overwrite({
	courseLevel,
	isRegisteredTarget,
	targetExists,
	existingLevel,
	courseId,
	dialogueId,
}) {
	const canonicalCourseLevel = normalizeCefrLevel(
		courseLevel,
		`Course "${courseId}" level`,
	);

	const protectedIdentity = Object.hasOwn(PROTECTED_A1, courseId) && PROTECTED_A1[courseId].includes(dialogueId);
	const existingIsA1 = existingLevel !== undefined && normalizeCefrLevel(existingLevel, `Existing lesson "${courseId}/${dialogueId}" level`) === "a1";
	if (protectedIdentity || existingIsA1 || (canonicalCourseLevel === "a1" && isRegisteredTarget && targetExists)) {
		throw new Error(
			`Refusing to overwrite registered A1 lesson "${courseId}/${dialogueId}". A1 lessons are protected from republishing.`,
		);
	}
}

export function validateDialogueLevel({
	draftLevel,
	courseLevel,
	courseId,
	dialogueId,
}) {
	const courseCanonical = normalizeCefrLevel(
		courseLevel,
		`Course "${courseId}" level`,
	);
	const draftCanonical = normalizeCefrLevel(
		draftLevel,
		`Draft "${courseId}/${dialogueId}" level`,
	);

	if (draftCanonical !== courseCanonical) {
		throw new Error(
			`Draft "${courseId}/${dialogueId}" level "${draftLevel}" does not match course "${courseId}" level "${courseLevel}".`,
		);
	}

	return draftCanonical;
}
