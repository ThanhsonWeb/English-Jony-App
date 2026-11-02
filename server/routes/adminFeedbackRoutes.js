const express = require("express");
const { protect, restrictTo } = require("../controllers/authController");
const privateResponse = require("../middleware/privateResponse");
const { getUnreadFeedbackCount, listFeedback, updateFeedbackStatus, deleteFeedback } = require("../controllers/adminFeedbackController");

const router = express.Router();
router.use(privateResponse, protect, restrictTo("admin"));
router.get("/unread-count", getUnreadFeedbackCount);
router.get("/", listFeedback);
router.patch("/:id/status", updateFeedbackStatus);
router.delete("/:id", deleteFeedback);

module.exports = router;
