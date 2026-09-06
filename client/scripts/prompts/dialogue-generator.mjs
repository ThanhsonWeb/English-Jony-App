export function buildDialoguePrompt({
  courseId,
  dialogueId,
  title,
  characters,
  level,
  situation,
  dialogueLines = 12,
  taskCount = 17,
}) {
  return `
You are creating a dialogue lesson for StudyJony,
an English-learning application for Vietnamese beginners.

COURSE
Course ID: ${courseId}
Dialogue ID: ${dialogueId}
Vietnamese title: ${title}
Characters: ${characters.join(", ")}
Level: ${level}
Situation: ${situation}

REQUIREMENTS

Dialogue:
- Exactly ${dialogueLines} dialogue lines.
- Natural everyday English.
- Appropriate for ${level} learners.

- Avoid unnecessary difficult vocabulary.
- Every line must have a Vietnamese translation.
- Keep the conversation realistic and connected.

Audio:
- Number each character's audio independently.
- Example:
  Leo first line → leo-01.mp3
  Mia first line → mia-01.mp3
  Leo second line → leo-02.mp3
- Reused dialogue lines must reuse the same audio path.

Useful words:
- Exactly 10 useful words or phrases.
- They should appear in the dialogue.
- Include Vietnamese meaning.
- Include a simple example when useful.

Exercises:
- Approximately ${taskCount} exercises.
- Use only:
  - fillBlank
  - multipleChoice
- Progress from easier to harder.
- Reusing dialogue sentences is allowed.
- Do not create meaningless repetitive exercises.
- Every multiple-choice answer must exist in its options.

Grammar:
- Only add grammar notes when genuinely useful.
- Explain grammar simply for Vietnamese beginners.

ASSET PATHS

Scene:
"/dialogue/${courseId}/${dialogueId}/bg.png"

Thumbnail:
"/dialogue/${courseId}/thumbnails/${dialogueId}.png"

Audio format:
"/dialogue/${courseId}/${dialogueId}/audio/{speaker}-{number}.mp3"

RETURN JSON ONLY.

Use this structure:

{
  "metadata": {
    "courseId": "",
    "dialogueId": "",
    "title": "",
    "level": "",
    "situation": "",
    "scene": "",
    "thumbnail": ""
  },

  "dialogue": [
    {
      "id": 1,
      "speaker": "",
      "text": "",
      "translation": "",
      "audioUrl": ""
    }
  ],

  "usefulWords": [
    {
      "word": "",
      "meaning": "",
      "example": ""
    }
  ],

  "tasks": [
    {
      "id": 1,
      "type": "fillBlank",
      "question": "",
      "answer": "",
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