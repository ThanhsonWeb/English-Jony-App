const express = require("express");
const { protect } = require("../controllers/authController");
const { getAllTopics, createTopic } = require("../controllers/topicController");

const router = express.Router();

// Routes
router.route("/").get(protect, getAllTopics).post(protect, createTopic);

module.exports = router;
