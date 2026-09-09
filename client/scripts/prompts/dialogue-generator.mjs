import {
	levelRules,
	normalizeLevel,
	structureRules,
} from "./dialogue-rules.mjs";

function formatRules(rules) {
	return rules.map((rule) => `- ${rule}`).join("\n");
}

export function buildDialoguePrompt(lessonConfig) {
	const {
		courseId,
		dialogueId,
		title,
		characters,
		level,
		situation,
		thumbnail,
	} = lessonConfig;
	const normalizedLevel = normalizeLevel(level);
	const selectedLevelRules = levelRules[normalizedLevel];
	const scene = `/dialogue/${courseId}/${dialogueId}/bg.png`;

	return `
You are creating a dialogue lesson for StudyJony,
an English-learning application for Vietnamese learners.

COURSE
Course ID: ${courseId}
Dialogue ID: ${dialogueId}
Vietnamese title: ${title}
Characters: ${characters.join(", ")}
Configured level: ${level}
Normalized CEFR level: ${normalizedLevel.toUpperCase()}
Situation: ${situation}

SHARED LESSON STRUCTURE

Dialogue:
- Create ${structureRules.dialogueLines.min}–${structureRules.dialogueLines.max} natural, connected dialogue lines.
- Keep the conversation realistic. Do not force speakers to alternate.
- Every line must have a Vietnamese translation.
- Give every dialogue line a unique numeric id.

Tasks:
- Create ${structureRules.tasks.min}–${structureRules.tasks.max} tasks total. Do not create tasks only to increase the count.
- Use only fillBlank and multipleChoice.
- Fill Blank must be the majority of all tasks.
- Multiple Choice must be at least 30% of the actual task total. Calculate the minimum as ceil(actual task count × ${structureRules.multipleChoiceRatio}).
- Practice each dialogue line immediately before moving to the next dialogue line.
- Give important/useful lines 2–3 tasks; simple lines usually receive 1 task.
- Every task must include dialogueLineId and reference an existing dialogue line.
- Repeated tasks for one line must preserve that line's speaker, transcript, scene, and audioUrl exactly.

Fill Blank:
- Use 1–3 blanks and vary what the blanks test.
- Mark every blank with underscores exactly where the missing word or phrase appears in the original dialogue line.
- Replacing each underscore marker with its answer must reconstruct the original transcript in the original word order.
- Never repeat the exact same task.

Multiple Choice:
- Test a useful phrase's meaning or genuine conversation/context understanding.
- A short useful phrase may be translated, but do not ask for a Vietnamese translation of the full English sentence.
- Ask only about information clearly supported by the dialogue.
- Include exactly one correct answer, and the answer must appear in options.

Audio:
- Use exactly one MP3 per dialogue line.
- Number each speaker's audio independently, starting at 01.
- Every task for a line must reuse that original line's audioUrl. Never create task-specific audio.

Useful Words:
- Include ${structureRules.usefulWords.min}–${structureRules.usefulWords.max} useful words or phrases that appear in the dialogue.
- Include pronunciation, Vietnamese meaning, and a simple example for every item.

Grammar:
- Grammar notes are optional. Include only genuinely useful patterns.
- Explain them simply for Vietnamese learners.

Core learning loop:
Natural dialogue → listen → practice each line 1–3× → repeat useful language → context understanding → useful words → Sổ tay

LANGUAGE DIFFICULTY — ${normalizedLevel.toUpperCase()}
${formatRules(selectedLevelRules)}

The CEFR level controls language difficulty only. It must not change the dialogue-line or task-count ranges above.

ASSET PATHS
Scene: "${scene}"
Thumbnail: "${thumbnail}"
Audio format: "/dialogue/${courseId}/${dialogueId}/audio/{speaker}-{number}.mp3"

RETURN JSON ONLY.

Use this structure:

{
  "metadata": {
    "courseId": "${courseId}",
    "dialogueId": "${dialogueId}",
    "title": "${title}",
    "level": "${normalizedLevel}",
    "situation": "${situation}",
    "scene": "${scene}",
    "thumbnail": "${thumbnail}"
  },
  "dialogue": [
    {
      "id": 1,
      "speaker": "",
      "text": "",
      "translation": "",
      "scene": "${scene}",
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
      "question": "",
      "answer": "",
      "speaker": "",
      "transcript": "",
      "scene": "${scene}",
      "audioUrl": ""
    },
    {
      "id": 2,
      "dialogueLineId": 1,
      "type": "multipleChoice",
      "question": "",
      "options": ["", "", "", ""],
      "answer": "",
      "speaker": "",
      "transcript": "",
      "scene": "${scene}",
      "audioUrl": ""
    }
  ],
  "grammarNotes": [
    {
      "title": "",
      "explanation": "",
      "example": ""
    }
  ]
}
`;
}
