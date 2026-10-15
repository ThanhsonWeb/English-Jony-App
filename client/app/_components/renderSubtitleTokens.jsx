import {
	SUBTITLE_WORD_PATTERN,
	SUBTITLE_WORD_TOKEN_PATTERN,
} from "@/app/_lib/dictionary/findPreferredLookup";

export default function renderSubtitleTokens(text, onWordClick, activeWordRange) {
	let wordIndex = -1;
	const segments = text.split(SUBTITLE_WORD_PATTERN).map((token, index) => ({
		index,
		token,
		wordIndex: SUBTITLE_WORD_TOKEN_PATTERN.test(token)
			? (wordIndex += 1)
			: null,
	}));
	const hasActivePhrase =
		activeWordRange &&
		activeWordRange.startWordIndex < activeWordRange.endWordIndex;
	const phraseStart = hasActivePhrase
		? segments.findIndex(
				(segment) => segment.wordIndex === activeWordRange.startWordIndex,
			)
		: -1;
	const phraseEnd = hasActivePhrase
		? segments.findLastIndex(
				(segment) => segment.wordIndex === activeWordRange.endWordIndex,
			)
		: -1;

	function renderWordButton(segment, isActive = false, grouped = false) {
		return (
			<button
				key={`${segment.token}-${segment.index}`}
				type="button"
				onClick={(event) => onWordClick(segment.wordIndex, event)}
				data-dictionary-token="true"
				className={`${grouped ? "" : "rounded-sm"} transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
					!grouped ? "hover:bg-white/10" : ""
				} ${isActive ? "bg-cyan-400/15 text-cyan-100" : ""}`}
			>
				{segment.token}
			</button>
		);
	}

	return segments.map((segment, index) => {
		if (index === phraseStart) {
			return (
				<span
					key={`active-phrase-${phraseStart}-${phraseEnd}`}
					className="box-decoration-clone rounded-sm bg-cyan-400/15 text-cyan-100"
				>
					{segments
						.slice(phraseStart, phraseEnd + 1)
						.map((phraseSegment) =>
							phraseSegment.wordIndex === null
								? phraseSegment.token
								: renderWordButton(phraseSegment, false, true),
						)}
				</span>
			);
		}

		if (index > phraseStart && index <= phraseEnd) return null;
		if (segment.wordIndex === null) return segment.token;

		const isActive =
			activeWordRange?.startWordIndex === segment.wordIndex &&
			activeWordRange.endWordIndex === segment.wordIndex;
		return renderWordButton(segment, isActive);
	});
}
