const tasks = require("../data/dialogueTaskCatalogue.json");
const allowed = new Set(tasks.map(ids => JSON.stringify(ids)));
const dialogues = new Set(tasks.map(([lessonId, dialogueId]) => JSON.stringify([lessonId, dialogueId])));
const rules = new Map(require("../data/dialogueTaskRules.json").map(rule => [JSON.stringify(rule.ids), rule]));

function isKnownDialogueTask(lessonId, dialogueId, taskId) {
	return allowed.has(JSON.stringify([lessonId, dialogueId, taskId]));
}

function getDialogueTaskRule(lessonId, dialogueId, taskId) {
	return rules.get(JSON.stringify([lessonId, dialogueId, taskId]));
}

function isKnownDialogue(lessonId, dialogueId) {
	return dialogues.has(JSON.stringify([lessonId, dialogueId]));
}

module.exports = { isKnownDialogue, isKnownDialogueTask, getDialogueTaskRule };
