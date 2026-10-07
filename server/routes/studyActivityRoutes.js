const express = require("express");
const authController = require("../controllers/authController");
const studyActivityController = require("../controllers/studyActivityController");
const learningRateLimit = require("../middleware/learningRateLimit");

const router = express.Router();

router.use(learningRateLimit.peer, authController.protect, learningRateLimit.user);

router
	.route("/")
	.get(studyActivityController.getActivities)
	.post(studyActivityController.recordActivity);

module.exports = router;
