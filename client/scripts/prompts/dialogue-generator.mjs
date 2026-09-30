import {
	levelRules,
	normalizeLevel,
	structureRules,
} from "./dialogue-rules.mjs";

function formatRules(rules) {
	return rules.map((rule) => `- ${rule}`).join("\n");
}

function formatSpeakerScenes(characters, scenes) {
	if (!scenes) {
		return "";
	}

	return characters
		.filter((character) => scenes[character])
		.map((character) => `- ${character}: "${scenes[character]}"`)
		.join("\n");
}

function formatPreviousDialogueSection(previousDialogue) {
	if (!Array.isArray(previousDialogue) || previousDialogue.length === 0) {
		return "";
	}

	return `
==================================================
PREVIOUS DIALOGUE — CONTINUITY CONTEXT
==================================================

The JSON below is the immediately previous dialogue in this course. Read it before writing the new dialogue.

- Continue naturally from what just happened; make the opening lines feel like the next scene.
- Preserve established facts, plans, items, relationships, and character knowledge.
- Do not reset the situation or make the characters act as if they are meeting for the first time.
- Avoid contradictions with events or details in the previous dialogue.

${JSON.stringify(previousDialogue, null, 2)}
`;
}

export function buildDialoguePrompt(lessonConfig) {
	const {
		courseId,
		dialogueId,
		title,
		courseTitle,
		courseDescription,
		characters,
		level,
		situation,
		thumbnail,
		scene: configuredScene,
		scenes,
		previousDialogue,
		teachesContractions = [],
	} = lessonConfig;

	const normalizedLevel = normalizeLevel(level);
	const selectedLevelRules = levelRules[normalizedLevel];
	const fillBlankRange =
		normalizedLevel === "a1"
			? structureRules.a1FillBlankRange
			: structureRules.fillBlankRange;
	const a1FillBlankRules =
		normalizedLevel === "a1"
			? `
A1 Fill Blank rules:

- Usually use only 1–2 blanks per task.
- Every answer may contain at most ${structureRules.a1FillBlankMaxAnswerWords} words total.
- Never hide 3 or more consecutive words in one blank. If two answer slots have only spaces or punctuation between them, count their words together.
- Prefer a one-word answer most of the time.
- Use a two-word answer only for a natural beginner chunk such as "thank you", "how much", or "would like".
- Prefer meaningful content words or useful short chunks.
- Keep enough words around each blank so its meaning is clear.
- Keep most of the sentence visible; do NOT make learners reconstruct a sentence.
- Do NOT hide a long phrase just because it is useful.

GOOD:
"There are so many ____ on this ____."
Answers: ["drinks", "menu"]

GOOD two-word chunk:
"____ very much."
Answer: ["Thank you"]

BAD:
"____ the bread for this week."
Answer: ["We need to buy"]
`
			: "";
	const a1MultipleChoiceRules =
		normalizedLevel === "a1"
			? `
A1 Multiple Choice balance:

- Add an "mcCategory" to every Multiple Choice task: "comprehension", "grammar", or "usage".
- For 4–6 Multiple Choice tasks, aim for 50–60% comprehension and 40–50% grammar plus usage. A useful split is 2/1/1 for 4 tasks, 3/1/1 for 5, and 3/1/2 or 3/2/1 for 6 (comprehension/grammar/usage).
- Include grammar-in-context questions about forms that actually appear in the linked dialogue line. Keep the question grounded in what the speaker said, not textbook terminology.
- When the dialogue naturally contains a useful A1 grammar pattern, include at least 1 grammar-in-context question (usually 1-2). Do not force one when there is no natural pattern.
- For every "grammar" or "usage" task, add "mcTarget" with the exact word or short phrase from that dialogue line that the question tests.
- Use "usage" for choosing a natural word or phrase in the situation; do not make it a dictionary definition.
- Keep the existing situation, intent, and meaning questions as the comprehension category.
- If the dialogue does not naturally support a grammar or usage question, do not invent one; use fewer MC tasks instead of forcing unrelated content.
`
			: "";
	const a1ContractionRules =
		normalizedLevel === "a1"
			? `
A1 contractions:

- Only these listed contractions may be used freely: ${structureRules.a1AllowedContractions.join(", ")}.
- Avoid every other contraction by default, including ${structureRules.a1RestrictedContractions.join(", ")}.
- Use a contraction outside the allowed list only when this lesson intentionally teaches it. List each exact form in metadata.teachesContractions and explain it in grammarNotes.
${teachesContractions.length ? `- This lesson explicitly teaches: ${teachesContractions.join(", ")}.` : ""}
`
			: "";
	const a1MetadataFields =
		normalizedLevel === "a1"
			? `\n\t\t"a1ContentRulesVersion": 2,\n\t\t"teachesContractions": ${JSON.stringify(teachesContractions)},`
			: "";
	const a1McCategoryField =
		normalizedLevel === "a1" ? `\n\t\t\t"mcCategory": "comprehension",` : "";

	if (!selectedLevelRules) {
		throw new Error(`Unsupported CEFR level: ${normalizedLevel}`);
	}

	const defaultScene =
		configuredScene ||
		scenes?.[characters[0]] ||
		`/dialogue/${courseId}/${dialogueId}/bg.png`;

	const hasSpeakerScenes =
		scenes && characters.some((character) => Boolean(scenes[character]));

	const sceneRules = hasSpeakerScenes
		? `
SCENE RULES

The characters are not necessarily in the same physical place.

Use these exact speaker-specific scene paths:

${formatSpeakerScenes(characters, scenes)}

Rules:

- Every dialogue line must use the scene belonging to its speaker.
- Every linked task must reuse the exact scene from its dialogue line.
- Never replace a speaker-specific scene with the default scene.
- Repeated tasks for the same dialogue line must preserve the same scene exactly.
- metadata.scene is only the fallback/default scene.
`
		: `
SCENE RULES

All dialogue lines use this shared scene:

"${defaultScene}"

Every linked task must reuse the same scene as its dialogue line.
`;

	return `
You are creating a dialogue lesson for StudyJony,
an English-learning application for Vietnamese learners.

COURSE

Course ID: ${courseId}
Dialogue ID: ${dialogueId}
Vietnamese title: ${title}
Course title hint: ${courseTitle || courseId}
Course description hint: ${courseDescription || situation}
Characters: ${characters.join(", ")}
Configured level: ${level}
Normalized CEFR level: ${normalizedLevel.toUpperCase()}
Situation: ${situation}
${formatPreviousDialogueSection(previousDialogue)}

LOCALIZATION (REQUIRED FOR EVERY NEW DRAFT)

- Set metadata.localizationVersion to 1.
- Include metadata.localized.courseTitle, courseDescription, title, and description, each with non-empty vi and en strings.
- metadata.localized.title.vi must equal metadata.title exactly; metadata.localized.description.vi must equal metadata.situation exactly.
- Translate course and dialogue titles/descriptions naturally into English. Do not leave a locale empty.
- Every task needs localized.title and localized.instruction with vi and en strings. If a task also has a plain title or instruction, its localized vi text must match exactly.
- Every Multiple Choice task also needs localized.question and localized.options. Keep question and options as Vietnamese strings for answer checking; localized.question.vi and each localized.options[i].vi must match them exactly. English options must keep the same order and meaning. Do not translate the English dialogue sentence or answer key.
- If a task has an explanation, completionMessage, or resultMessage, localize it too. Localize grammar note titles and explanations; their vi text must match the plain fields exactly.
- Keep dialogue.text and task transcripts in English. Keep dialogue.translation and vocabulary meanings in Vietnamese for learning.
- Generic buttons and statuses such as Continue, Check, Correct, and Try again belong to shared UI translation files; do not add them to this JSON.

==================================================
DIALOGUE RULES
==================================================

Dialogue length should depend on the situation.

- Use as many lines as needed to complete the communication goal naturally.
- Simple situations may be short.
- More complex situations may need more lines.
- Do not add filler just to reach a target.
- Do not cut useful dialogue just to stay under a limit.
- Keep the language appropriate for the configured CEFR level.
- Most dialogues may naturally fall around 8–16 lines, but this is guidance, not a strict requirement.
- Use short sentences, common vocabulary, and simple structures.
- Give the dialogue ONE clear communication goal.
- Every line should naturally connect to the next.
- Do NOT force speakers to alternate.
- Avoid awkward sentences written only to teach grammar or vocabulary.
- Prefer useful everyday phrases and conversational chunks.
- Repeat useful vocabulary and conversational chunks naturally when helpful.
- Avoid repeating the same whole sentence or sentence pattern just to create practice.
- Prefer vocabulary and chunk repetition over full-sentence repetition.
- Every dialogue line must have a Vietnamese translation.
- Give every dialogue line a unique sequential numeric id, starting from 1.

NATURAL TURN-TAKING

- Do NOT mechanically alternate speakers line by line.
- A speaker may say 1–3 short sentences in one turn when that sounds natural.
- The same speaker may have two consecutive dialogue lines to explain, react, clarify, or add information before another character responds.
- Vary turn length naturally: some turns are very short; others may contain 2–3 simple sentences appropriate for the configured level.
- Do NOT force longer turns or consecutive lines just to satisfy this rule.
- Keep A1 sentences short, common, and easy. Do not increase language complexity to make a turn longer.
- Keep the exchange believable with static characters and focused on one clear communication goal.

BAD (mechanical alternation):
Ben: I like pasta.
Emma: Me too.
Ben: The chicken pasta looks good.
Emma: I want something lighter.

BETTER (natural turn lengths):
Ben: I like pasta. The chicken pasta looks good.
Emma: Me too, but I want something lighter. Maybe the soup.
Ben: What about the tomato soup?

STATIC-SCENE RULE

StudyJony characters are mostly static images.

Avoid dialogue that depends on visible physical actions the UI cannot show.

Avoid lines such as:

- "Pass me the pot."
- "Here you go."
- "Hold this."
- "Pull the rope."
- "Put this there."

Prefer dialogue about:

- what the characters see
- questions
- preferences
- plans
- opinions
- reactions
- decisions
- the current situation

A line should still feel believable if the learner only sees static characters.

Dialogue = what the learner hears and understands.

==================================================
EXERCISE RULES
==================================================

- Practice the dialogue from beginning to end.
- Classify every dialogue line with practicePriority: "simple", "important", or "veryImportant".
- Use "simple" for a supporting, reaction, or low-value transition line.
- Use "important" for a useful reusable sentence or phrase worth practicing twice.
- Use "veryImportant" only for a core sentence directly tied to the dialogue's main communication goal and worth deeper repetition.
- Count only standalone Fill Blank tasks for per-line practice repetition.
- Multiple Choice is a separate learning check and does NOT count toward per-line practice.
- The final Dialogue Cloze is review and does NOT count toward per-line practice.
- A simple line must receive exactly 1 Fill Blank task.
- An important line must receive exactly 2 distinct Fill Blank tasks.
- A very important line must receive 2 distinct Fill Blank tasks and may receive a third only when the line contains a third meaningful target.
- Keep repeated practice directly in the natural dialogue flow.
- Do NOT create a separate review section just for repetition.
- Avoid two tasks that test exactly the same thing.
- Fill Blank is the main task type.
- Multiple Choice should only be used when it genuinely checks learning.
- Do NOT create filler tasks just to increase task count.
- Quality is more important than task count.
- Give every task a unique sequential numeric id, starting from 1.
- Every linked task must include dialogueLineId.
- dialogueLineId must reference an existing dialogue line.
- Repeated tasks for the same line must preserve speaker, transcript, scene, and audioUrl exactly.
- Once practice moves to a later dialogueLineId, do not return to an earlier one.
- The only exception is the final full-dialogue review.
- For a typical dialogue, usually include around 4–6 meaningful Multiple Choice tasks when the conversation supports them.
- Do not force a quiz when it would be weak or repetitive.

Fill Blank:

- Use ${fillBlankRange.min}–${fillBlankRange.max} meaningful blanks per task.
- Blank useful words or phrases, not random filler words.
- Store the unchanged text around the blanks in a "parts" array.
- Use one entry in "answers" for every blank.
- Store parts and answers in left-to-right order.
- "parts" must contain exactly one more item than "answers".
- Interleaving parts and answers must reconstruct the original transcript exactly.
- Preserve punctuation and contractions from the original transcript.
- Do NOT use an underscore-based "question" field for Fill Blank tasks.
- Do NOT create the exact same Fill Blank task twice.
- If the same line receives multiple Fill Blank tasks, blank different useful words or phrases that do not overlap in the source sentence.
${a1FillBlankRules}

Example:

Transcript:
"I would like a small coffee, please."

Parts:
["I would like a ", " ", ", please."]

Answers:
["small", "coffee"]

Multiple Choice:

- Purpose: Multiple Choice is a separate learning check for comprehension, grammar-in-context, and usage. It must not act like another Fill Blank or translation exercise.
- Prefer questions about situation comprehension: what is happening, what the speaker needs or wants, or which information matters.
- Prefer questions about speaker intent: why the speaker says something, what the speaker is trying to do, or what a response shows.
- Prefer questions about sequence, decisions, and reactions: what should happen next, what the speaker decided, or how the speaker feels from context.
- Grammar-in-context is allowed only when the dialogue naturally contains a useful grammar or politeness pattern.
- Grammar-in-context questions must explain the function of language in the real situation, not test grammar terminology for its own sake.
${normalizedLevel === "a1" ? a1MultipleChoiceRules : "- Usually use 0-2 grammar-in-context questions per dialogue. Never force one when there is no useful natural pattern."}
- Use Multiple Choice only when it adds real learning value.
- Do NOT create a Multiple Choice task for every dialogue line.
- Each Multiple Choice task must test something different from every Fill Blank task linked to the same dialogue line.
- Keep questions short and easy for the configured CEFR level. For A1, use simple Vietnamese wording.
- Do NOT use Multiple Choice for vocabulary definitions or dictionary-style meaning questions.
- Do NOT ask for a Vietnamese translation of the entire English sentence.
- Do NOT simply ask for the Vietnamese meaning of the current dialogue line.
- Ask only about information clearly supported by the dialogue.
- Wrong answers must be plausible, clearly incorrect, and related to the same situation. Do not use silly or random distractors.
- Include exactly one correct answer.
- Include exactly four options.
- The correct answer must appear in options.
- Across the dialogue, distribute correct-answer positions roughly across A, B, C, and D.
- Do not heavily overuse one answer position.
- Avoid an obvious fixed pattern such as A-B-C-D-A-B-C-D.
- Keep the correct answer unchanged when balancing positions; reorder the options instead.
- For 5 Multiple Choice tasks, a natural distribution could be D, A, B, C, A.
- For 21 Multiple Choice tasks, a healthy distribution is roughly A:6, B:5, C:5, D:5.

BAD:
English: "Is it very sweet?"
Question: "Ben muốn nói gì?"
Answer: "Nó có ngọt lắm không?"

GOOD:
Question: "Ben đang hỏi về điều gì của chiếc muffin?"
Answer: "Độ ngọt."

Final review:

- The final task must have type "dialogueCloze".
- It must review the entire dialogue.
- Include every dialogue line in the original order.
- Preserve every speaker exactly.
- The completed cloze must reconstruct every original transcript exactly.
- Replace useful words or phrases with blanks.
- Use unique sequential blank IDs beginning with "1".
- The final dialogueCloze does NOT require dialogueLineId at task level.
- Do NOT add task-level speaker, transcript, scene, or audioUrl.
- The final dialogueCloze task ID must be the next sequential number after the final practice task.

Exercise = how the learner practices and remembers the dialogue.

==================================================
AUDIO
==================================================

- Do not leave scene or audioUrl empty.
- Every dialogue line must use the configured scene and its correctly numbered audioUrl.
- Every linked task must reuse those exact values.
- Use exactly one MP3 per dialogue line.
- Number each speaker's audio independently starting at 01.
- Every task linked to a dialogue line must reuse that line's original audioUrl.
- Never create task-specific audio.
- The same dialogue line must always preserve the same speaker, transcript, scene, and audioUrl.

==================================================
USEFUL WORDS
==================================================

- Include around ${structureRules.usefulWords.min}–${structureRules.usefulWords.max} useful words or phrases, depending on the dialogue.
- Do not add low-value vocabulary just to reach a number.
- Every useful word or phrase must actually appear in the dialogue.
- Prefer useful conversational chunks over low-value isolated vocabulary.
- Include pronunciation.
- Include Vietnamese meaning.
- Include one simple beginner-friendly example.

==================================================
GRAMMAR
==================================================

- Grammar notes are optional.
- Include only useful patterns that already appear naturally in the dialogue.
- Do NOT force grammar into the conversation.
- Explain grammar simply for Vietnamese learners.
- Keep examples beginner-friendly.
- If no useful grammar point exists, return "grammarNotes": [].

==================================================
CORE LEARNING LOOP
==================================================

Natural dialogue
→ listen
→ practice each line
→ repeat useful language
→ check comprehension, grammar, and usage
→ full dialogue cloze
→ useful words
→ Sổ tay

==================================================
LANGUAGE DIFFICULTY — ${normalizedLevel.toUpperCase()}
==================================================

${formatRules(selectedLevelRules)}
${a1ContractionRules}

The CEFR level controls language difficulty only.

Task count may vary depending on the dialogue.

Prioritize learning quality over a fixed number of tasks.

${sceneRules}

==================================================
ASSET PATHS
==================================================

Default/fallback scene:
"${defaultScene}"

Thumbnail:
"${thumbnail}"

Audio format:
"/dialogue/${courseId}/${dialogueId}/audio/{speaker}-{number}.mp3"

==================================================
OUTPUT
==================================================

Return the complete JSON inside one fenced \`json\` code block.
Do not write explanations, summaries, or comments before or after the code block.
Keep the entire JSON in this single code block so it can be copied at once.

The Fill Blank, Multiple Choice, and Dialogue Cloze objects below are examples of possible task types only.
Do not create every task type for every dialogue line.
Task selection must follow the Exercise Rules above.

Use this structure:

{
	"metadata": {
		"courseId": "${courseId}",
		"dialogueId": "${dialogueId}",
		"title": "${title}",
		"localizationVersion": 1,
		"localized": {
			"courseTitle": { "vi": "", "en": "" },
			"courseDescription": { "vi": "", "en": "" },
			"title": { "vi": "${title}", "en": "" },
			"description": { "vi": "${situation}", "en": "" }
		},
		"level": "${normalizedLevel}",
		${a1MetadataFields}
		"situation": "${situation}",
		"scene": "${defaultScene}",
		"thumbnail": "${thumbnail}"
	},

	"dialogue": [
		{
			"id": 1,
			"speaker": "",
			"text": "",
			"translation": "",
			"practicePriority": "simple",
			"scene": "",
			"audioUrl": ""
		}
	],

	"usefulWords": [
		{
			"word": "",
			"pronunciation": "",
			"meaning": "",
			"example": ""
		}
	],

	"tasks": [
		{
			"id": 1,
			"dialogueLineId": 1,
			"type": "fillBlank",
			"localized": {
				"title": { "vi": "", "en": "" },
				"instruction": { "vi": "", "en": "" }
			},
			"parts": ["", ""],
			"answers": [""],
			"speaker": "",
			"transcript": "",
			"scene": "",
			"audioUrl": ""
		},

		{
			"id": 2,
			"dialogueLineId": 1,
			"type": "multipleChoice",
			"question": "",
			"localized": {
				"title": { "vi": "", "en": "" },
				"instruction": { "vi": "", "en": "" },
				"question": { "vi": "", "en": "" },
				"options": [
					{ "vi": "", "en": "" },
					{ "vi": "", "en": "" },
					{ "vi": "", "en": "" },
					{ "vi": "", "en": "" }
				]
			},
			${a1McCategoryField}
			${normalizedLevel === "a1" ? '"mcTarget": "",' : ""}
			"options": ["", "", "", ""],
			"answer": "",
			"speaker": "",
			"transcript": "",
			"scene": "",
			"audioUrl": ""
		},

		{
			"id": 3,
			"type": "dialogueCloze",
			"localized": {
				"title": { "vi": "", "en": "" },
				"instruction": { "vi": "", "en": "" }
			},
			"lines": [
				{
					"dialogueLineId": 1,
					"speaker": "",
					"parts": [
						"",
						{
							"id": "1",
							"blank": ""
						},
						""
					]
				}
			]
		}
	],

	"grammarNotes": [
		{
			"title": "",
			"explanation": "",
			"localized": {
				"title": { "vi": "", "en": "" },
				"explanation": { "vi": "", "en": "" }
			},
			"example": ""
		}
	]
}
`;
}
