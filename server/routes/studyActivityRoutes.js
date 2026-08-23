const express = require("express");
const authController = require("../controllers/authController");
const studyActivityController = require("../controllers/studyActivityController");

const router = express.Router();

router.use(authController.protect);

router
	.route("/")
	.get(studyActivityController.getActivities)
	.post(studyActivityController.recordActivity);

module.exports = router;