export function getFlashcardFaceContent(word, side) {
	if (side === "back") {
		return {
			primary: word.vietnamese,
			context: word.english,
			example: word.example || "",
		};
	}

	return {
		primary: word.english,
		pronunciation: word.pronunciation || "",
	};
}
