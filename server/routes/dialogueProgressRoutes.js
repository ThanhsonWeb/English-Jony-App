const express = require("express");

const {
	getLessonProgress,
	completeTask,
} = require("../controllers/dialogueProgressController.js");

const { protect } = require("../controllers/authController.js");

const router = express.Router();

router.use(protect);

router.get("/:lessonId", getLessonProgress);

router.patch(
	"/:lessonId/:dialogueId/tasks/:taskId",
	completeTask,
);

module.exports = router;