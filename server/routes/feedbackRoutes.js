const express = require("express");
const rateLimit = require("express-rate-limit");
const { submitFeedback } = require("../controllers/feedbackController");

const router = express.Router();
const feedbackLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: process.env.NODE_ENV === "development" ? 20 : 5,
	standardHeaders: "draft-8",
	legacyHeaders: false,
	message: { status: "fail", message: "Too many feedback submissions. Please try again later." },
});

router.post("/", feedbackLimiter, submitFeedback);

module.exports = router;
