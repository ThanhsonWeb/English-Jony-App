const express = require("express");

const {
	getLessonProgress,
	completeTask,
	getLatestProgress,
} = require("../controllers/dialogueProgressController.js");

const { protect } = require("../controllers/authController.js");

const router = express.Router();

router.use(protect);

router.get("/latest", getLatestProgress);
router.get("/:lessonId", getLessonProgress);
router.patch("/:lessonId/:dialogueId/tasks/:taskId", completeTask);

module.exports = router;
