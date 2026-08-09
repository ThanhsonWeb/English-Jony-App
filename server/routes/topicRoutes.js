const express = require("express");
const { protect } = require("../controllers/authController");
const {
	getAllTopics,
	createTopic,
	deleteTopic,
} = require("../controllers/topicController");

const router = express.Router();

// Routes
router.route("/").get(protect, getAllTopics).post(protect, createTopic);
router.route("/:id").delete(protect, deleteTopic);

module.exports = router;
