const express = require("express");

const {
	getLessonProgress,
	completeTask,
	getLatestProgress,
} = require("../controllers/dialogueProgressController.js");

const { protect } = require("../controllers/authController.js");
const learningRateLimit = require("../middleware/learningRateLimit");

const router = express.Router();

router.use(learningRateLimit.peer, protect, learningRateLimit.user);

router.get("/latest", getLatestProgress);
router.get("/:lessonId", getLessonProgress);
router.patch("/:lessonId/:dialogueId/tasks/:taskId", completeTask);

module.exports = router;
