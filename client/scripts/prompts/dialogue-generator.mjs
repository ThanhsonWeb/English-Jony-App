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

export function buildDialoguePrompt(lessonConfig) {
  const {
    courseId,
    dialogueId,
    title,
    characters,
    level,
    situation,
    thumbnail,
    scene: configuredScene,
    scenes,
  } = lessonConfig;

  const normalizedLevel = normalizeLevel(level);
  const selectedLevelRules = levelRules[normalizedLevel];

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
Characters: ${characters.join(", ")}
Configured level: ${level}
Normalized CEFR level: ${normalizedLevel.toUpperCase()}
Situation: ${situation}

==================================================
DIALOGUE RULES
==================================================

- Create ${structureRules.dialogueLines.min}–${structureRules.dialogueLines.max} natural, connected dialogue lines.
- Use beginner-friendly language appropriate for the configured CEFR level.
- Use short sentences, common vocabulary, and simple structures where appropriate.
- Give the dialogue ONE clear communication goal.
- Every line should naturally connect to the next.
- Do NOT force speakers to alternate.
- Avoid awkward sentences written only to teach grammar or vocabulary.
- Prefer useful everyday phrases and chunks.
- Repeat useful phrases naturally when it helps memory.
- Every line must have a Vietnamese translation.
- Give every dialogue line a unique numeric id.

STATIC-SCENE RULE

The StudyJony characters are mostly static images.

Avoid dialogue that depends on visible physical actions the UI cannot show.

Avoid lines such as:
- "Pass me the pot."
- "Here you go."
- "Hold this."
- "Pull the rope."
- "Put this there."

Prefer:
- talking about what they see
- asking simple questions
- making plans
- giving opinions
- reacting
- describing the situation
- making simple decisions

A line should still feel believable if the learner only sees static characters.

Dialogue = what the learner hears and understands.

==================================================
EXERCISE RULES
==================================================

- Practice the dialogue from beginning to end.
- Practice each dialogue line before moving to the next.
- Important or useful lines may receive 2–3 tasks.
- Simple lines usually receive 1 task.
- Every dialogue line should receive at least 1 task.
- Fill Blank is the main task type.
- Multiple Choice should only be used when it genuinely tests conversation understanding.
- Do NOT create filler tasks just to reach a number.
- Quality is more important than task count.
- Every linked task must include dialogueLineId and reference an existing dialogue line.
- Repeated tasks for the same line must preserve that line's speaker, transcript, scene, and audioUrl exactly.
- Once practice moves to a later dialogueLineId, do not go back to an earlier line unless the final full-dialogue review requires it.

Fill Blank:

- Use ${structureRules.fillBlankRange.min}–${structureRules.fillBlankRange.max} meaningful blanks.
- Blank useful words or phrases, not random filler words.
- Mark each blank with underscores exactly where the missing text appears.
- Replacing every blank with its answer must reconstruct the original transcript exactly.
- Do NOT create the exact same task twice.

Multiple Choice:

- Test genuine conversation or context understanding.
- A short useful phrase may be tested for meaning.
- Do NOT ask for a Vietnamese translation of the entire English sentence.
- Wrong answers should be believable.
- Ask only about information clearly supported by the dialogue.
- Include exactly one correct answer.
- The answer must appear in options.

Final review:

- The final task must have type "dialogueCloze".
- It must review the entire dialogue.
- Include every dialogue line in the original order.
- Preserve every speaker and original transcript exactly.
- Replace useful words or phrases with blanks.
- The completed cloze must reconstruct the original dialogue exactly.
- Use unique sequential blank IDs starting from "1".
- The final dialogueCloze does not require dialogueLineId.
- Do not add task-level speaker, transcript, scene, or audioUrl to the final dialogueCloze.
- The final dialogueCloze task ID must be the next sequential number after the last practice task.

Exercise = how the learner practices and remembers the dialogue.

==================================================
AUDIO
==================================================

- Use exactly one MP3 per dialogue line.
- Number each speaker's audio independently, starting at 01.
- Every linked task for a line must reuse that original line's audioUrl.
- Never create task-specific audio.
- The same dialogue line must always preserve the same speaker, character, scene, transcript, and audioUrl.

==================================================
USEFUL WORDS
==================================================

- Include ${structureRules.usefulWords.min}–${structureRules.usefulWords.max} useful words or phrases.
- Every useful word or phrase must appear in the dialogue.
- Prefer useful conversational chunks over low-value isolated vocabulary.
- Include pronunciation.
- Include Vietnamese meaning.
- Include a simple beginner-friendly example.

==================================================
GRAMMAR
==================================================

- Grammar notes are optional.
- Include only genuinely useful beginner patterns that already appear naturally in the dialogue.
- Do not force grammar into the dialogue just to teach it.
- Explain grammar simply for Vietnamese learners.

==================================================
CORE LEARNING LOOP
==================================================

Natural dialogue
→ listen
→ practice each line
→ repeat useful language
→ check conversation understanding
→ full dialogue cloze
→ useful words
→ Sổ tay

==================================================
LANGUAGE DIFFICULTY — ${normalizedLevel.toUpperCase()}
==================================================

${formatRules(selectedLevelRules)}

The CEFR level controls language difficulty only.

Task count may vary depending on the dialogue.
Prioritize learning quality over a fixed number of tasks.

${sceneRules}

==================================================
ASSET PATHS
==================================================

Default/fallback scene: "${defaultScene}"
Thumbnail: "${thumbnail}"

Audio format:
"/dialogue/${courseId}/${dialogueId}/audio/{speaker}-{number}.mp3"

==================================================
OUTPUT
==================================================

RETURN JSON ONLY.

Use this structure:

{
  "metadata": {
    "courseId": "${courseId}",
    "dialogueId": "${dialogueId}",
    "title": "${title}",
    "level": "${normalizedLevel}",
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
      "question": "",
      "answer": "",
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
      "options": ["", "", "", ""],
      "answer": "",
      "speaker": "",
      "transcript": "",
      "scene": "",
      "audioUrl": ""
    },
// The final dialogueCloze task ID must be the next sequential number after the last practice task.
    {
      "id": 3,
      "type": "dialogueCloze",
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
      "example": ""
    }
  ]
}
`;
}