const tasks = require("../data/dialogueTaskCatalogue.json");
const allowed = new Set(tasks.map(ids => JSON.stringify(ids)));

function isKnownDialogueTask(lessonId, dialogueId, taskId) {
	return allowed.has(JSON.stringify([lessonId, dialogueId, taskId]));
}

module.exports = { isKnownDialogueTask };
